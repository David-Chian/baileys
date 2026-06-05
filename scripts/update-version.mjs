#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')
const FALLBACK_VERSION = [2, 3000, 1033105955]

async function fetchLatestWaWebVersion() {
	const headers = {
		'sec-fetch-site': 'none',
		'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
	}

	const response = await fetch('https://web.whatsapp.com/sw.js', {
		method: 'GET',
		headers
	})

	if (!response.ok) {
		throw new Error(`Failed to fetch sw.js: ${response.status} ${response.statusText}`)
	}

	const data = await response.text()
	const match = data.match(/\\?"client_revision\\?":\s*(\d+)/)

	if (!match?.[1]) {
		throw new Error('Could not find client revision in WhatsApp Web service worker')
	}

	return [2, 3000, Number(match[1])]
}

function updateJsonVersion(relativePath, version) {
	const filePath = join(ROOT_DIR, relativePath)

	try {
		const currentContent = readFileSync(filePath, 'utf8')
		const currentVersion = JSON.parse(currentContent).version

		if (currentVersion[0] === version[0] && currentVersion[1] === version[1] && currentVersion[2] === version[2]) {
			console.log(`[ok] ${relativePath} already up to date`)
			return false
		}

		writeFileSync(filePath, `${JSON.stringify({ version })}\n`)
		console.log(`[ok] Updated ${relativePath}: [${currentVersion.join(', ')}] -> [${version.join(', ')}]`)
		return true
	} catch (error) {
		if (error?.code === 'ENOENT') {
			return false
		}

		console.error(`[error] Failed to update ${relativePath}:`, error)
		throw error
	}
}

function updateConstVersion(relativePath, constName, version) {
	const filePath = join(ROOT_DIR, relativePath)

	try {
		const content = readFileSync(filePath, 'utf8')
		const versionRegex = new RegExp(`const ${constName} = \\[(\\d+),\\s*(\\d+),\\s*(\\d+)\\]`)
		const match = content.match(versionRegex)

		if (!match) {
			throw new Error(`Could not find ${constName} declaration in ${relativePath}`)
		}

		const currentVersion = [Number(match[1]), Number(match[2]), Number(match[3])]

		if (currentVersion[0] === version[0] && currentVersion[1] === version[1] && currentVersion[2] === version[2]) {
			console.log(`[ok] ${relativePath} already up to date`)
			return false
		}

		const newContent = content.replace(versionRegex, `const ${constName} = [${version[0]}, ${version[1]}, ${version[2]}]`)

		writeFileSync(filePath, newContent)
		console.log(`[ok] Updated ${relativePath}: [${currentVersion.join(', ')}] -> [${version.join(', ')}]`)
		return true
	} catch (error) {
		console.error(`[error] Failed to update ${relativePath}:`, error)
		throw error
	}
}

async function main() {
	console.log('Fetching latest WhatsApp Web version...\n')

	let version = FALLBACK_VERSION

	try {
		version = await fetchLatestWaWebVersion()
	} catch (error) {
		console.error('Failed to fetch latest version:', error)
		process.exit(1)
	}

	console.log(`Latest version: [${version.join(', ')}]\n`)

	const updates = [
		updateJsonVersion('src/Defaults/baileys-version.json', version),
		updateConstVersion('lib/Utils/generics.js', 'baileysVersion', version),
		updateConstVersion('lib/Defaults/index.js', 'version', version)
	]

	const hasUpdates = updates.some(Boolean)

	console.log('')
	if (hasUpdates) {
		console.log('Version update complete!')

		if (process.env.GITHUB_OUTPUT) {
			appendFileSync(process.env.GITHUB_OUTPUT, 'version_updated=true\n')
			appendFileSync(process.env.GITHUB_OUTPUT, `wa_version=${version.join('.')}\n`)
		}
	} else {
		console.log('All version files are already up to date.')

		if (process.env.GITHUB_OUTPUT) {
			appendFileSync(process.env.GITHUB_OUTPUT, 'version_updated=false\n')
			appendFileSync(process.env.GITHUB_OUTPUT, `wa_version=${version.join('.')}\n`)
		}
	}
}

main().catch(error => {
	console.error('Fatal error:', error)
	process.exit(1)
})
