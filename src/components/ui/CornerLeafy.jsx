  const [landed, setLanded] = useState(false)
  const text = useMemo(() => modalText(coin), [coin])

  useEffect(() => {
    if (!open) {
      setLanded(false)
      setBubble('')
      speech.current?.cancel()
      return
    }
    openChat()
    const fly = setTimeout(() => setLanded(true), 2200)
    const read = setTimeout(() => {
      const line = text || 'Jeg kan læse det her op for dig.'
      setBubble(line)
      speech.current?.speak(line)
    }, 4600)
    return () => {
      clearTimeout(fly)
      clearTimeout(read)
    }
  }, [open, text, openChat])

  if (!open) return null

  return (
    <div className={landed ? 'wl-corner is-landed' : 'wl-corner'} style={{ zIndex: 90 }}>
      {bubble && <div className="wl-room-bubble wl-glass wl-corner-bubble">{bubble}</div>}
      <div className="wl-corner-stage" onClick={openChat} onDoubleClick={openMenu}>
        <Canvas camera={{ position: [0, 0.15, 3.4], fov: 35 }} gl={{ alpha: true, antialias: true }} style={{ width: 148, height: 160, background: 'transparent' }}>
          <ambientLight intensity={1.1} />
          <SameLeafy />
        </Canvas>
      </div>
    </div>
  )
}
