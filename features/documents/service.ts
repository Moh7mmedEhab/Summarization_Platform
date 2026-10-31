import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { storage, userStorageKey } from "@/lib/storage/storage";
import { env } from "@/lib/env";
import type { DocumentKind, SourceKind, SummaryStyle } from "@/generated/prisma/enums";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "forbidden" | "conflict" | "invalid" | "too_large",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type UploadedFile = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  kind: SourceKind;
};

function inputTypeOf(files: UploadedFile[], hasText: boolean): DocumentKind {
  const kinds = new Set(files.map((f) => f.kind));
  if (kinds.has("pdf") || kinds.has("docx")) return "pdf";
  if (kinds.has("image")) return "image_set";
  if (kinds.has("audio") || hasText || files.length === 0) return "text";
  return "text";
}

/** Count of points across the current summary's sections (rows show "N key points"). */
export function summaryPointCount(content: unknown): number {
  const secs = (content as { sections?: any[] })?.sections;
  if (!Array.isArray(secs)) return 0;
  return secs.reduce((n, s) => n + (Array.isArray(s?.points) ? s.points.length : 0), 0);
}

/** Create a document (pasted text and/or uploaded files) without summarizing. */
export async function createDocument(
  userId: string,
  input: {
    title: string;
    description?: string;
    text?: string;
    files?: UploadedFile[];
  },
): Promise<{ documentId: string }> {
  const files = input.files ?? [];
  const hasText = !!input.text?.trim();
  if (!hasText && files.length === 0) {
    throw new DomainError("Provide pasted text or at least one file", "invalid");
  }
  // Server-side truth for the pasted-text cap — enforced here so the limit
  // holds regardless of which caller (upload or JSON create) sends the text.
  const maxText = env().UPLOAD_MAX_TEXT_CHARS;
  if (hasText && input.text!.length > maxText) {
    throw new DomainError(`Pasted text exceeds the ${maxText} character limit`, "too_large");
  }

  // Explicit id so files can be written to storage under the final key BEFORE
  // any database work — no file I/O inside the transaction.
  const documentId = crypto.randomUUID();
  const storedKeys: string[] = [];
  try {
    // 1) Large I/O first, outside any interactive transaction: a failed write
    //    here means nothing was persisted, so there are no rows to clean up.
    // Keys are computed once and reused in the rows below.
    const preparedFiles = files.map((f) => {
      const key = userStorageKey(userId, documentId, f.name);
      storedKeys.push(key);
      return { f, key };
    });
    for (const { f, key } of preparedFiles) {
      await storage.put(key, f.bytes);
    }

    // 2) Short transaction: document row + asset rows in one batch, no I/O.
    let position = 0;
    const assetRows: Prisma.SourceAssetCreateManyInput[] = [];
    if (hasText) {
      assetRows.push({
        documentId,
        assetType: "text",
        position: position++,
        extractedText: input.text,
        mimeType: "text/plain",
        fileSize: Buffer.byteLength(input.text!, "utf8"),
      });
    }
    for (const { f, key } of preparedFiles) {
      assetRows.push({
        documentId,
        assetType: f.kind,
        position: position++,
        originalFilename: f.name.slice(0, 300),
        mimeType: f.mimeType,
        fileSize: f.bytes.byteLength,
        storageKey: key,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.create({
        data: {
          id: documentId,
          userId,
          title: input.title.slice(0, 300),
          description: input.description?.slice(0, 2000),
          inputType: inputTypeOf(files, hasText),
          status: "draft",
        },
      });
      await tx.sourceAsset.createMany({ data: assetRows });
    });

    return { documentId };
  } catch (error) {
    const cleanupResults = await Promise.allSettled(storedKeys.map((key) => storage.remove(key)));
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error(
          `[storage] failed to clean up an upload after document creation failed: ${
            result.reason instanceof Error ? result.reason.message : result.reason
          }`,
        );
      }
    });
    throw error;
  }
}

export async function getOwnedDocument(
  userId: string,
  documentId: string,
  include?: {
    assets?: boolean;
    summary?: boolean;
    job?: boolean;
  },
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: {
      SourceAssets: include?.assets ? { orderBy: { position: "asc" } } : false,
      Summaries: include?.summary ? { where: { current: true }, take: 1 } : false,
      ProcessingJob: include?.job
        ? {
            where: { status: { in: ["queued", "running"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, progress: true, stage: true, error: true, createdAt: true },
          }
        : false,
    },
  });
  if (!doc) throw new DomainError("Document not found", "not_found");
  return doc;
}

export type ListQuery = {
  q?: string;
  kind?: "all" | DocumentKind;
  status?: "all" | "summarized" | "draft" | "processing" | "failed";
  sort?: "recent" | "oldest" | "title";
  page?: number;
  perPage?: number;
};

export type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  inputType: DocumentKind;
  status: string;
  createdAt: string;
  assetCount: number;
  keptPercent: number | null;
  summaryPoints: number;
  summaryId: string | null;
};

export async function listDocuments(userId: string, query: ListQuery) {
  const perPage = Math.min(24, Math.max(4, query.perPage ?? 8));
  const page = Math.max(1, query.page ?? 1);
  const where = {
    userId,
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.kind && query.kind !== "all" ? { inputType: query.kind } : {}),
    ...(query.status && query.status !== "all" ? { status: query.status } : {}),
  };
  const orderBy =
    query.sort === "title" ? { title: "asc" as const }
    : query.sort === "oldest" ? { createdAt: "asc" as const }
    : { createdAt: "desc" as const };

  const [total, docs] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        title: true,
        description: true,
        inputType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { SourceAssets: true } },
        Summaries: {
          where: { current: true },
          take: 1,
          select: { id: true, summaryWordCount: true, sourceWordCount: true, content: true },
        },
      },
    }),
  ]);

  const items: LibraryItem[] = docs.map((d) => {
    const s = d.Summaries[0];
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      inputType: d.inputType,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      assetCount: d._count.SourceAssets,
      keptPercent:
        s?.sourceWordCount && s.summaryWordCount != null
          ? Math.round((s.summaryWordCount / Math.max(1, s.sourceWordCount)) * 100)
          : null,
      summaryPoints: summaryPointCount(s?.content),
      summaryId: s?.id ?? null,
    };
  });
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function updateDocument(
  userId: string,
  documentId: string,
  input: { title?: string; description?: string },
) {
  await assertOwned(documentId, userId);
  return prisma.document.update({
    where: { id: documentId },
    data: {
      ...(input.title !== undefined ? { title: input.title.slice(0, 300) } : {}),
      ...(input.description !== undefined ? { description: input.description?.slice(0, 2000) } : {}),
    },
  });
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { SourceAssets: { select: { storageKey: true } } },
  });
  if (!doc) throw new DomainError("Document not found", "not_found");
  await prisma.document.delete({ where: { id: documentId } });
  const removalResults = await Promise.allSettled(
    (doc.SourceAssets.map((a) => a.storageKey).filter(Boolean) as string[]).map((key) =>
      storage.remove(key),
    ),
  );
  removalResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        `[storage] failed to remove a private file after document deletion: ${
          result.reason instanceof Error ? result.reason.message : result.reason
        }`,
      );
    }
  });
}

export async function assertOwned(documentId: string, userId: string): Promise<void> {
  const ok = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });
  if (!ok) throw new DomainError("Document not found", "not_found");
}

/** Start summarization: one open job per document (unique mutex). */
export async function startSummarization(
  userId: string,
  documentId: string,
  input: { language: "en" | "ar"; style: SummaryStyle },
): Promise<{ jobId: string }> {
  await assertOwned(documentId, userId);
  if (!env().GEMINI_API_KEY) {
    throw new DomainError(
      "AI summarization is not configured on the server (GEMINI_API_KEY missing)",
      "invalid",
    );
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE
      `;
      const openJobs = await tx.processingJob.count({
        where: { userId, status: { in: ["queued", "running"] } },
      });
      if (openJobs >= 3) {
        throw new DomainError(
          "Too many jobs processing right now — wait for one to finish",
          "conflict",
        );
      }

      const job = await tx.processingJob.create({
        data: {
          documentId,
          userId,
          type: "summarize",
          payload: { language: input.language, style: input.style },
          mutex: documentId,
        },
      });
      await tx.document.update({ where: { id: documentId }, data: { status: "processing" } });
      return { jobId: job.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("This document is already processing", "conflict");
    }
    throw e;
  }
}
