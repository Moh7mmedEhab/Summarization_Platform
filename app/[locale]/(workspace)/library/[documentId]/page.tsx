import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { DomainError, getOwnedDocument } from "@/features/documents/service";
import type { SummaryContentT } from "@/lib/ai/schema";
import SummaryViewer from "@/components/summary/viewer";
import { relTime } from "@/lib/ai/reltime";
import { DocIcon, TextIcon, ImageIcon, AudioIcon } from "@/components/icons";

type Props = {
  params: Promise<{ locale: string; documentId: string }>;
};

const statusKey = {
  draft: "draft",
  processing: "processing",
  summarized: "summarized",
  failed: "failed",
} as const;

const slotIcon = {
  pdf: <DocIcon />,
  docx: <DocIcon />,
  text: <TextIcon />,
  image_set: <ImageIcon />,
  audio: <AudioIcon />,
} as const;

/** Document + its current notes (the summary viewer), over owned data. */
export default async function DocumentPage({ params }: Props) {
  const { locale, documentId } = await params;
  const session = await requireSession();
  const t = await getTranslations({ locale, namespace: "library" });

  const doc = await getOwnedDocument(session.user.id, documentId, {
    assets: true,
    summary: true,
  }).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });

  const summary = doc.Summaries[0] ?? null;
  const content = summary ? (summary.content as unknown as SummaryContentT) : null;
  const audioCount = doc.SourceAssets.filter((a) => a.assetType === "audio").length;
  const docAssetType = doc.SourceAssets[0]?.originalFilename ?? doc.title;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{doc.title}</h1>
          <p className="docmeta num">
            {slotIcon[doc.inputType]}
            <span>{t(`status.${statusKey[doc.status]}`)}</span>
            {" · "}
            <span>{relTime(doc.createdAt.toISOString(), locale)}</span>
            {audioCount > 0 ? (
              <>
                {" · "}
                <AudioIcon />
                <span>
                  {t("audioNote", { count: audioCount })}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <a className="btn" href={`/api/documents/${doc.id}/download?asset=${doc.SourceAssets[0]?.id ?? ""}`} title={docAssetType}>
          {t("actions.downloadSource")}
        </a>
      </div>

      {content && summary ? (
        <SummaryViewer
          documentId={doc.id}
          summaryId={summary.id}
          content={content}
          keptPercent={
            summary.sourceWordCount && summary.summaryWordCount != null
              ? Math.round((summary.summaryWordCount / Math.max(1, summary.sourceWordCount)) * 100)
              : null
          }
          sourceWords={summary.sourceWordCount}
          summaryWords={summary.summaryWordCount}
          hasAudio={audioCount > 0}
        />
      ) : (
        <div className="panel" style={{ marginTop: "var(--gap)", padding: 24 }}>
          <p className="sub">{t(`status.${statusKey[doc.status]}`)}</p>
        </div>
      )}
    </>
  );
}
