      <MainSceneBackground paused={!ready} />
      <div className="absolute inset-0 z-10" style={{ opacity: ready && sceneVisible ? 1 : 0, pointerEvents: !ready || isModalOpen ? 'none' : 'auto' }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        {ready && !isModalOpen && <HUD />}
        {ready && !isModalOpen && <ScrollHint />}
      </div>
      {!ready && <LoadingScreen />}
      {ready && <LeafyMenu />}
      {ready && <Suspense fallback={null}><Modal /></Suspense>}
      {ready && <CornerLeafy />}
