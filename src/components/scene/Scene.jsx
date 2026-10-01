function SceneContents({ shadows, modal }) {
  return (
    <>
      <Lighting shadows={shadows} />
      {USE_TREE ? <LifeTree /> : (
        <Suspense fallback={null}>
          <CenterLeafy docked={modal} />
        </Suspense>
      )}
      {!modal && <OrbitingCoins />}
    </>
  )
}
