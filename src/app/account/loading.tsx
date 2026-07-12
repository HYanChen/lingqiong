export default function AccountLoading() {
  return (
    <div aria-label="正在加载用户中心" className="space-y-5">
      <div className="h-52 animate-pulse rounded-3xl border border-white/8 bg-white/[0.035]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="h-32 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" key={index} />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
    </div>
  );
}
