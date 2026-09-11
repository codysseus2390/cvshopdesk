import logoAsset from "@/assets/cedar-valley-logo.jpg.asset.json";

export const cedarLogoUrl = logoAsset.url;

export function CedarLogo({ className = "h-10" }: { className?: string }) {
  return <img src={cedarLogoUrl} alt="Cedar Valley Tire & Auto Service" className={className} />;
}
