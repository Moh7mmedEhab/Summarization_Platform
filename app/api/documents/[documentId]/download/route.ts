import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { DomainError, getOwnedDocument } from "@/features/documents/service";
import { storage } from "@/lib/storage/storage";

type Params = { params: Promise<{ documentId: string }> };

/**
 * GET /api/documents/[documentId]/download?asset=<assetId>
 * Authenticated, owner-only download of a private source file (inline content
 * types like pasted text download as a .txt file).
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) throw new DomainError("Sign in to continue", "forbidden");
    const { documentId } = await params;
    const assetId = request.nextUrl.searchParams.get("asset");
    if (!assetId) throw new DomainError("Which asset? (missing ?asset)", "invalid");

    const doc = await getOwnedDocument(session.user.id, documentId, { assets: true });
    const asset = doc.SourceAssets.find((a) => a.id === assetId);
    if (!asset) throw new DomainError("Asset not found", "not_found");

    if (asset.assetType === "text" || !asset.storageKey) {
      const text = asset.extractedText ?? "";
      return new NextResponse(text, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `attachment; filename="${(asset.originalFilename ?? "material").replace(/[^\w.\- ]+/g, "_")}.txt"`,
        },
      });
    }

    const bytes = await storage.get(asset.storageKey);
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "content-type": asset.mimeType ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${(asset.originalFilename ?? "asset").replace(/[^\w.\- ]+/g, "_")}"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
