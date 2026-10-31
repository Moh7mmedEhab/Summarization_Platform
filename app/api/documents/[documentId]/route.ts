import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, failJson, okJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import {
  DomainError,
  getOwnedDocument,
  updateDocument,
  deleteDocument,
} from "@/features/documents/service";
import { summaryPointCount } from "@/features/documents/service";
import type { SummaryContentT } from "@/lib/ai/schema";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
});

type Params = { params: Promise<{ documentId: string }> };

/** GET /api/documents/[documentId] — document + assets + current summary + open job. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) throw new DomainError("Sign in to continue", "forbidden");
    const { documentId } = await params;
    const doc = await getOwnedDocument(session.user.id, documentId, {
      assets: true,
      summary: true,
      job: true,
    });
    const summary = doc.Summaries[0] ?? null;
    const content = summary ? (summary.content as unknown as SummaryContentT) : null;
    return okJson({
      document: {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        inputType: doc.inputType,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        assets: doc.SourceAssets.map((a) => ({
          id: a.id,
          assetType: a.assetType,
          position: a.position,
          originalFilename: a.originalFilename,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          hasText: !!a.extractedText,
          metadata: audioMeta(a.metadata),
        })),
        summary: summary
          ? {
              id: summary.id,
              language: summary.language,
              style: summary.style,
              content,
              model: summary.model,
              promptVersion: summary.promptVersion,
              coverageMetadata: summary.coverageMetadata,
              sourceWordCount: summary.sourceWordCount,
              summaryWordCount: summary.summaryWordCount,
              createdAt: summary.createdAt.toISOString(),
              points: content ? summaryPointCount(content) : 0,
            }
          : null,
        job: doc.ProcessingJob[0]
          ? {
              id: doc.ProcessingJob[0].id,
              status: doc.ProcessingJob[0].status,
              progress: doc.ProcessingJob[0].progress,
              stage: doc.ProcessingJob[0].stage,
              error: doc.ProcessingJob[0].error,
            }
          : null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

function audioMeta(meta: unknown): unknown {
  const m = meta as { durationSec?: number } | null;
  return m?.durationSec ? { durationSec: m.durationSec } : null;
}

/** PATCH /api/documents/[documentId] — rename / edit description. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) throw new DomainError("Sign in to continue", "forbidden");
    const { documentId } = await params;
    const body = patchSchema.parse(await request.json());
    await updateDocument(session.user.id, documentId, body);
    return okJson({ updated: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/documents/[documentId] — removes assets, summaries, and private files. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) throw new DomainError("Sign in to continue", "forbidden");
    const { documentId } = await params;
    await deleteDocument(session.user.id, documentId);
    return okJson({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
