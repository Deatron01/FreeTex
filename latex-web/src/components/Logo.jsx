export default function Logo({ size = 28, withText = true }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#059669" />
        <path d="M14 20h22v6h-8v22h-6V26h-8z" fill="#fff" />
        <path d="M34 34h16v5h-5.5v13H39V39h-5z" fill="#a7f3d0" />
      </svg>
      {withText && (
        <span className="text-lg">
          Free<span className="text-brand-600">Tex</span>
        </span>
      )}
    </span>
  );
}
