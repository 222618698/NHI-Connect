export default function Logo({ size = 32 }: { size?: number }) {
  return <img src="/nhi-connect-logo.png" alt="NHI-Connect logo" width={size} height={size} className="object-contain shrink-0" />;
}
