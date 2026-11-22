/**
 * After `vite build`, copy PHP API + upload scaffolding into dist/
 * so Hostinger Git deploy (output: dist) never wipes /api again.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

function copyApi() {
  const src = join(root, 'api')
  const dest = join(dist, 'api')
  cpSync(src, dest, {
    recursive: true,
    filter: (path) => {
      const rel = path.replace(/\\/g, '/')
      if (rel.includes('config.local.php')) return false
      return true
    },
  })
  console.log('[bundle-deploy] copied api/ -> dist/api/')
}

function copyUploadsScaffold() {
  const uploads = join(dist, 'uploads')
  mkdirSync(join(uploads, 'coins'), { recursive: true })
  mkdirSync(join(uploads, 'avatars'), { recursive: true })

  const htaccess = join(root, 'uploads', '.htaccess')
  if (existsSync(htaccess)) {
    cpSync(htaccess, join(uploads, '.htaccess'))
  } else {
    writeFileSync(
      join(uploads, '.htaccess'),
      'Options -Indexes\n<FilesMatch "\\.(php)$">\n  Require all denied\n</FilesMatch>\n'
    )
  }
  console.log('[bundle-deploy] created dist/uploads/ scaffold')
}

function patchHtaccess() {
  const htaccess = join(dist, '.htaccess')
  if (!existsSync(htaccess)) return
  let content = readFileSync(htaccess, 'utf8')
  if (!content.includes('^/api/')) {
    console.warn('[bundle-deploy] dist/.htaccess may not exclude /api — check public/.htaccess')
  }
}

copyApi()
copyUploadsScaffold()
patchHtaccess()
console.log('[bundle-deploy] done — dist is ready for Hostinger Git deploy')
