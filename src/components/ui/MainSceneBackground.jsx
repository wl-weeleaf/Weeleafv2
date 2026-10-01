/** Main-page backdrop — sunrise community image. */
export default function MainSceneBackground({ paused = false }) {
  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      <img
        src="/scene-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={paused ? { filter: 'saturate(0.9)' } : undefined}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,220,170,0.08), rgba(20,10,6,0.18))',
        }}
      />
    </div>
  )
}
