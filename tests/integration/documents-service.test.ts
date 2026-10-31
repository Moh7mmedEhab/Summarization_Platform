import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createDocument,
  getOwnedDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  startSummarization,
  DomainError,
  summaryPointCount,
} from "@/features/documents/service";
import { storage } from "@/lib/storage/storage";

describe("Document Service & Multi-Tenant IDOR Security", () => {
  const runId = `doc_svc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const userA = `${runId}_userA`;
  const userB = `${runId}_userB`;
  let userADocId: string;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: userA, name: "Student A", email: `${userA}@margins.test`, emailVerified: true },
        { id: userB, name: "Student B", email: `${userB}@margins.test`, emailVerified: true },
      ],
    });
  });

  afterAll(async () => {
    for (const ownerId of [userA, userB]) {
      const documents = await prisma.document.findMany({
        where: { userId: ownerId },
        select: { id: true },
      });
      for (const document of documents) {
        await deleteDocument(ownerId, document.id);
      }
    }
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates a document with pasted text", async () => {
    const { documentId } = await createDocument(userA, {
      title: "Biology 101 Notes",
      description: "Introductory lecture on cell division",
      text: "Mitosis has four main stages: prophase, metaphase, anaphase, and telophase.",
    });
    userADocId = documentId;
    expect(documentId).toBeDefined();

    const doc = await getOwnedDocument(userA, documentId, { assets: true });
    expect(doc.title).toBe("Biology 101 Notes");
    expect(doc.inputType).toBe("text");
    expect(doc.SourceAssets.length).toBe(1);
    expect(doc.SourceAssets[0].assetType).toBe("text");
    expect(doc.SourceAssets[0].extractedText).toContain("Mitosis has four main stages");
  });

  it("creates a document with uploaded files and stores them via storage", async () => {
    const sampleBytes = new TextEncoder().encode("%PDF-1.4 sample pdf content for test");
    const { documentId } = await createDocument(userA, {
      title: "Physics PDF Chapter",
      files: [
        {
          name: "chapter1.pdf",
          mimeType: "application/pdf",
          bytes: sampleBytes,
          kind: "pdf",
        },
      ],
    });

    const doc = await getOwnedDocument(userA, documentId, { assets: true });
    expect(doc.inputType).toBe("pdf");
    expect(doc.SourceAssets.length).toBe(1);
    expect(doc.SourceAssets[0].storageKey).toBeDefined();

    // Verify stored file on disk
    const storedBytes = await storage.get(doc.SourceAssets[0].storageKey!);
    expect(storedBytes).toEqual(sampleBytes);
  });

  it("rejects creation if neither text nor files are provided", async () => {
    await expect(
      createDocument(userA, {
        title: "Empty Submission",
      })
    ).rejects.toThrow(DomainError);
  });

  it("SECURITY (IDOR): User B CANNOT retrieve User A's document", async () => {
    await expect(
      getOwnedDocument(userB, userADocId)
    ).rejects.toThrow("Document not found");
  });

  it("SECURITY (IDOR): User B CANNOT update/rename User A's document", async () => {
    await expect(
      updateDocument(userB, userADocId, { title: "Hacked Title" })
    ).rejects.toThrow("Document not found");

    // Verify title was not changed
    const doc = await getOwnedDocument(userA, userADocId);
    expect(doc.title).toBe("Biology 101 Notes");
  });

  it("SECURITY (IDOR): User B CANNOT delete User A's document", async () => {
    await expect(
      deleteDocument(userB, userADocId)
    ).rejects.toThrow("Document not found");

    // Verify document still exists
    const doc = await getOwnedDocument(userA, userADocId);
    expect(doc).toBeDefined();
  });

  it("lists documents strictly scoped to the authenticated user", async () => {
    // Create a document for User B
    await createDocument(userB, {
      title: "User B Private Chemistry",
      text: "Avogadro's constant is approximately 6.022 x 10^23.",
    });

    const listA = await listDocuments(userA, { page: 1 });
    expect(listA.items.length).toBeGreaterThanOrEqual(1);
    expect(listA.items.every((document) => document.title !== "User B Private Chemistry")).toBe(true);

    const listB = await listDocuments(userB, { page: 1 });
    expect(listB.items.length).toBe(1);
    expect(listB.items[0].title).toBe("User B Private Chemistry");
  });

  it("enforces the per-user open-job limit under concurrent requests", async () => {
    const documents = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createDocument(userA, { title: `Queued document ${index}`, text: "Lecture text." }),
      ),
    );

    const outcomes = await Promise.allSettled(
      documents.map(({ documentId }) =>
        startSummarization(userA, documentId, { language: "en", style: "comprehensive" }),
      ),
    );

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(3);
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: "rejected",
      reason: { code: "conflict" },
    });
    expect(
      await prisma.processingJob.count({
        where: { userId: userA, status: { in: ["queued", "running"] } },
      }),
    ).toBe(3);
  });

  it("calculates summaryPointCount correctly", () => {
    const mockContent = {
      sections: [
        { points: [{ text: "p1" }, { text: "p2" }] },
        { points: [{ text: "p3" }] },
        { points: [] },
      ],
    };
    expect(summaryPointCount(mockContent)).toBe(3);
    expect(summaryPointCount(null)).toBe(0);
    expect(summaryPointCount({})).toBe(0);
  });

  it("deletes document and its associated storage assets safely", async () => {
    await deleteDocument(userA, userADocId);
    await expect(getOwnedDocument(userA, userADocId)).rejects.toThrow();
  });
});
