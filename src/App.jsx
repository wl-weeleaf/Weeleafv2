function LoadingScreen({ label }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #050f08 0%, #0a1f10 50%, #061209 100%)' }}>
      <div className="relative h-44 w-44">
        <img src="/wl-logo.png" alt="WeeLeaf" className="h-full w-full object-contain" />
        <div className="absolute animate-spin rounded-full" style={{ inset: '6%', border: '3px solid rgba(240,192,112,.2)', borderTopColor: '#f6e7a8' }} />
      </div>
      <div className="mt-5 font-display text-2xl tracking-[0.18em] text-white">WeeLeaf</div>
      <div className="mt-2 text-sm text-green-200">{label}</div>
    </div>
  )
}
