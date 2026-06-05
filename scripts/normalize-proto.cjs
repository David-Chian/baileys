#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs')

const file = process.argv[2] || 'WAProto/WAProto.proto'
const input = readFileSync(file, 'utf8')
const lines = input.split(/\r?\n/)
const stack = []
let changed = 0

function topIsOneof() {
	return stack.includes('oneof')
}

function countChar(line, char) {
	return [...line].filter(c => c === char).length
}

for (let i = 0; i < lines.length; i++) {
	let line = lines[i]
	const closes = countChar(line, '}')

	for (let c = 0; c < closes; c++) {
		stack.pop()
	}

	const inOneof = topIsOneof()

	if (/^\s*(required|optional|repeated)\s+map\s*</.test(line)) {
		line = line.replace(/^(\s*)(required|optional|repeated)\s+/, '$1')
		changed++
	}

	if (/^\s*required\s+/.test(line)) {
		line = inOneof
			? line.replace(/^(\s*)required\s+/, '$1')
			: line.replace(/^(\s*)required\s+/, '$1optional ')
		changed++
	}

	if (inOneof && /^\s*(optional|required|repeated)\s+/.test(line)) {
		line = line.replace(/^(\s*)(optional|required|repeated)\s+/, '$1')
		changed++
	}

	lines[i] = line

	const opens = countChar(line, '{')

	if (opens > 0) {
		const nowTrimmed = line.trim()

		for (let o = 0; o < opens; o++) {
			stack.push(/^oneof\s+/.test(nowTrimmed) ? 'oneof' : 'block')
		}
	}
}

writeFileSync(file, lines.join('\n').replace(/\n+$/, '\n'), 'utf8')
console.log(`Normalized ${file} changes: ${changed}`)
