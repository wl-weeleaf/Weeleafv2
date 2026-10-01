function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: WL.modalBackdrop }}>
      <SoftClouds className="absolute inset-0" />
      <div className="relative z-10 h-44 w-44">
        <img src="/wl-logo.png" alt="" className="absolute left-1/2 top-1/2 h-full w-full object-contain" style={{ transform: 'translate(-54%, -49%)' }} />
        <div className="absolute animate-spin rounded-full" style={{ inset: '5.5%', border: '3px solid rgba(200,144,74,.28)', borderTopColor: '#c8904a' }} />
      </div>
    </div>
  )
}
