import { gradientFrameClass } from "./formStyles";

const AI_PROVIDER_ORDER = ["deepseek", "mimo", "perplexity"] as const;
const AI_PROVIDER_META: Record<string, { label: string; bg: string; text: string; iconBg: string; iconText: string }> = {
  deepseek: { label: "DeepSeek", bg: "bg-[#E6F9FA]", text: "text-brand-teal-dark", iconBg: "bg-brand-teal-dark", iconText: "text-white" },
  mimo: { label: "MiMo", bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]", iconBg: "bg-[#7C5CD1]", iconText: "text-white" },
  perplexity: { label: "Perplexity", bg: "bg-[#FFF3D6]", text: "text-brand-gold-dark", iconBg: "bg-brand-gold-dark", iconText: "text-white" },
};

// Official brand marks (via Simple Icons, CC0-licensed monochrome vendor
// logos) for the providers that have one — nominative use to identify which
// service was actually called, not an endorsement claim. MiMo has no
// published logo mark of its own (it's a research model, not a branded
// consumer product), so it keeps the monogram fallback below.
function DeepSeekLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  );
}

function PerplexityLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z" />
    </svg>
  );
}

const PROVIDER_LOGOS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  deepseek: DeepSeekLogo,
  perplexity: PerplexityLogo,
};

// Real vendor mark when one's available (deepseek/perplexity above);
// otherwise falls back to a plain monogram — e.g. MiMo, which has no
// published logo of its own.
function ProviderIcon({ provider, className = "" }: { provider: string; className?: string }) {
  const meta = AI_PROVIDER_META[provider];
  const Logo = PROVIDER_LOGOS[provider];
  if (Logo) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-black/[0.06] ${meta?.text ?? "text-[#4B5468]"} ${className}`}
      >
        <Logo className="h-[65%] w-[65%]" />
      </span>
    );
  }
  const letter = meta?.label?.[0] ?? provider[0]?.toUpperCase() ?? "?";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[10px] ${meta?.iconBg ?? "bg-[#9AA3B2]"} ${meta?.iconText ?? "text-white"} ${className}`}
    >
      {letter}
    </span>
  );
}

export type AiUsageRow = { provider: string; model: string | null; calls: number; totalTokens: number; costUsd: number | null };

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[12px] bg-[#F8FAFB] p-[14px] text-xs text-[#9AA3B2]">{children}</p>;
}

export default function AiUsageCard({ aiUsage }: { aiUsage: AiUsageRow[] }) {
  const totalCostUsd = aiUsage.reduce((sum, u) => sum + (u.costUsd ?? 0), 0);
  const hasUnknownCost = aiUsage.some((u) => u.costUsd === null && u.calls > 0);

  return (
    <div className={gradientFrameClass("teal")}>
      <div className="flex h-full flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
        <div className="flex items-center justify-between gap-[8px]">
          <p className="text-sm text-[#141B2E]">AI usage</p>
          {aiUsage.length > 0 && (
            <span className="text-xs text-[#4B5468]">
              ~${totalCostUsd.toFixed(2)}
              {hasUnknownCost ? "+" : ""}
            </span>
          )}
        </div>

        {aiUsage.length === 0 ? (
          <EmptyRow>
            No AI features used yet — company lookup, job posting suggestions, and match scoring will show up here
            once you use them.
          </EmptyRow>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {AI_PROVIDER_ORDER.filter((provider) => aiUsage.some((u) => u.provider === provider)).map((provider) => {
              const rows = aiUsage.filter((u) => u.provider === provider);
              const meta = AI_PROVIDER_META[provider] ?? { label: provider, bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
              return (
                <div key={provider} className="flex flex-col gap-[6px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                  <span className={`flex w-fit items-center gap-[6px] rounded-full py-[3px] pr-[10px] pl-[4px] text-xs ${meta.bg} ${meta.text}`}>
                    <ProviderIcon provider={provider} className="h-[18px] w-[18px]" />
                    {meta.label}
                  </span>
                  {rows.map((usage) => (
                    <div key={usage.model ?? "unknown"} className="flex items-center justify-between gap-[8px] pl-[2px]">
                      <span className="text-xs text-[#4B5468]">{usage.model ?? "unknown model"}</span>
                      <span className="shrink-0 text-xs text-[#9AA3B2]">
                        {usage.calls} call{usage.calls === 1 ? "" : "s"}
                        {usage.totalTokens > 0 ? ` · ${usage.totalTokens.toLocaleString("en-US")} tok` : ""}
                        {usage.costUsd !== null ? ` · ~$${usage.costUsd.toFixed(3)}` : " · cost n/a"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="text-[11px] text-[#9AA3B2]">
              Estimated from published list pricing, not an exact bill — MiMo&rsquo;s rate is an unverified
              third-party estimate, not an official Xiaomi rate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
