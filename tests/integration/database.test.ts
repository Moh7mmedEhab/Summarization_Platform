import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("Database Integration & Constraints (PostgreSQL test db)", () => {
  const testRunId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userAEmail = `${testRunId}_user_a@margins.test`;
  const userBEmail = `${testRunId}_user_b@margins.test`;

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: {
        id: `${testRunId}_ua`,
        name: "Test User A",
        email: userAEmail,
        emailVerified: true,
      },
    });
    userAId = userA.id;
  });

  afterAll(async () => {
    // Cascade cleanup
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [userAEmail, userBEmail],
        },
      },
    });
  });

  it("creates a user successfully", async () => {
    const userA = await prisma.user.findUnique({ where: { id: userAId } });
    expect(userA?.id).toBeDefined();
    expect(userA?.email).toBe(userAEmail);
  });

  it("enforces unique email constraint (duplicate email rejection)", async () => {
    await expect(
      prisma.user.create({
        data: {
          id: `${testRunId}_ua_dup`,
          name: "Duplicate User",
          email: userAEmail,
          emailVerified: false,
        },
      })
    ).rejects.toThrow();
  });

  it("creates user preference and cascades on user deletion", async () => {
    const tempUser = await prisma.user.create({
      data: {
        id: `${testRunId}_temp_user`,
        name: "Temp User",
        email: `${testRunId}_temp@margins.test`,
        emailVerified: true,
        Preference: {
          create: {
            language: "ar",
            appearanceMode: "dark",
            accentPalette: "mint",
          },
        },
      },
      include: { Preference: true },
    });

    expect(tempUser.Preference).toBeDefined();
    expect(tempUser.Preference?.appearanceMode).toBe("dark");
    expect(tempUser.Preference?.accentPalette).toBe("mint");

    // Delete temp user
    await prisma.user.delete({ where: { id: tempUser.id } });

    // Preference should be cascade-deleted
    const pref = await prisma.userPreference.findUnique({
      where: { userId: tempUser.id },
    });
    expect(pref).toBeNull();
  });

  it("creates document, source asset, summary, and cascades on document deletion", async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        title: "Test Lesson",
        inputType: "pdf",
        status: "summarized",
        SourceAssets: {
          create: {
            assetType: "pdf",
            storageKey: `u/${userAId}/test.pdf`,
            fileSize: 1024,
            mimeType: "application/pdf",
          },
        },
        Summaries: {
          create: {
            userId: userAId,
            language: "en",
            style: "comprehensive",
            model: "gemini-3.8-flash",
            promptVersion: "1.0.0",
            content: {
              title: "Test Lesson Summary",
              language: "en",
              overview: "This is a test overview.",
              sections: [],
            },
          },
        },
      },
      include: {
        SourceAssets: true,
        Summaries: true,
      },
    });

    expect(doc.SourceAssets.length).toBe(1);
    expect(doc.Summaries.length).toBe(1);

    const docId = doc.id;
    // Delete document
    await prisma.document.delete({ where: { id: docId } });

    // Verify cascade deletion of SourceAsset and Summary
    const assets = await prisma.sourceAsset.findMany({ where: { documentId: docId } });
    expect(assets.length).toBe(0);

    const summaries = await prisma.summary.findMany({ where: { documentId: docId } });
    expect(summaries.length).toBe(0);
  });

  it("verifies strict multi-tenant data isolation", async () => {
    const userB = await prisma.user.create({
      data: {
        id: `${testRunId}_ub`,
        name: "Test User B",
        email: userBEmail,
        emailVerified: true,
      },
    });
    userBId = userB.id;

    // User A creates a private document
    const docA = await prisma.document.create({
      data: {
        userId: userAId,
        title: "User A Confidential Notes",
        inputType: "text",
        status: "draft",
      },
    });

    // Querying by User B id should NEVER return User A's document
    const userBDocs = await prisma.document.findMany({
      where: { userId: userBId },
    });
    expect(userBDocs.some((d) => d.id === docA.id)).toBe(false);

    // Direct findUnique with userId filter returns null for unauthorized user
    const directQuery = await prisma.document.findFirst({
      where: { id: docA.id, userId: userBId },
    });
    expect(directQuery).toBeNull();
  });
});
