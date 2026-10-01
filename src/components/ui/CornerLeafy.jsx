  return (
    <div className={landed ? 'wl-corner is-landed' : 'wl-corner'}>
      {bubble && <div className="wl-room-bubble wl-glass wl-follow-bubble">{bubble}</div>}
      <div className="wl-corner-stage" onClick={openChat} onDoubleClick={openMenu}>
        <Canvas camera={{ position: [0, 0.2, 3.6], fov: 32 }} gl={{ alpha: true, antialias: true }} style={{ width: 220, height: 240, background: 'transparent' }}>
          <ambientLight intensity={1.1} />
          <SameLeafy />
        </Canvas>
      </div>
    </div>
  )
}
