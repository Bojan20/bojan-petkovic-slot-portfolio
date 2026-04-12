/**
 * Smoke Test — Headless browser runtime error check
 *
 * Loads the app in Chromium, captures console errors for 3 seconds,
 * reports any JS errors. Exit code 0 = clean, 1 = errors found.
 *
 * Usage: node scripts/smoke-test.mjs [url]
 */

import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5190'
const WAIT_MS = 4000

console.log(`[smoke] Testing ${url} ...`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  // Disable extensions to avoid false positives
  bypassCSP: true,
})
const page = await context.newPage()

const errors = []
const warnings = []

// Capture console errors
page.on('console', (msg) => {
  const type = msg.type()
  const text = msg.text()

  // Filter out known non-issues
  if (text.includes('listener indicated an asynchronous response')) return
  if (text.includes('Download the React DevTools')) return
  if (text.includes('favicon.svg')) return

  if (type === 'error') {
    errors.push(text)
  } else if (type === 'warning') {
    warnings.push(text)
  }
})

// Capture uncaught exceptions
page.on('pageerror', (err) => {
  errors.push(`[UNCAUGHT] ${err.message}`)
})

// Capture failed requests (broken assets)
page.on('requestfailed', (req) => {
  const url = req.url()
  // Ignore favicon
  if (url.includes('favicon')) return
  errors.push(`[NETWORK] Failed to load: ${url}`)
})

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })

  if (!response || response.status() >= 400) {
    errors.push(`[HTTP] Status ${response?.status() ?? 'null'}`)
  }

  // Wait for React to render
  await page.waitForTimeout(WAIT_MS)

  // Check that #root has children (React rendered something)
  const rootChildren = await page.evaluate(() => {
    const root = document.getElementById('root')
    return root ? root.children.length : 0
  })

  if (rootChildren === 0) {
    errors.push('[RENDER] #root is empty — React did not mount')
  }

  // Check for visible error boundaries or crash screens
  const errorScreenVisible = await page.evaluate(() => {
    const body = document.body.innerText || ''
    return body.includes('Something went wrong') || body.includes('Error') && body.includes('Retry')
  })

  if (errorScreenVisible) {
    errors.push('[RENDER] Error boundary or crash screen is visible')
  }

} catch (err) {
  errors.push(`[NAVIGATION] ${err.message}`)
}

await browser.close()

// Report
console.log('')
if (errors.length === 0) {
  console.log(`✅ [smoke] PASS — No runtime errors (${warnings.length} warnings)`)
  if (warnings.length > 0) {
    warnings.forEach((w) => console.log(`  ⚠ ${w}`))
  }
  process.exit(0)
} else {
  console.log(`❌ [smoke] FAIL — ${errors.length} error(s):`)
  errors.forEach((e) => console.log(`  ✗ ${e}`))
  if (warnings.length > 0) {
    console.log(`\n  + ${warnings.length} warning(s):`)
    warnings.forEach((w) => console.log(`  ⚠ ${w}`))
  }
  process.exit(1)
}
