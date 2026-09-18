// Keep this brand asset in the repository so local, staging, and future hosting
// do not depend on Lovable's managed asset path.
export const cedarLogoUrl = "/cedar-valley-logo.jpg";

export function CedarLogo({ className = "h-10" }: { className?: string }) {
  return <img src={cedarLogoUrl} alt="Cedar Valley Tire & Auto Service" className={className} />;
}
