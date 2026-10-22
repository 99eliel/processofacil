import { copyFile } from 'node:fs/promises'

await copyFile(new URL('../index.source.html', import.meta.url), new URL('../index.html', import.meta.url))
