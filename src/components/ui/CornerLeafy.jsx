    openChat()
    const line = text || 'Jeg kan læse det her op for dig.'
    setBubble(line)
    const fly = setTimeout(() => setLanded(true), 0)
    speech.current?.speak(line)
    return () => clearTimeout(fly)
