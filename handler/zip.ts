import { createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import unzipper from 'unzipper';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

/**
 * Decompresses a zip file containing a compressed text file
 * @param inputZipPath Path to the input zip file
 * @param outputTxtPath Path where the text file will be extracted
 */
export async function decompressTheZipFile(inputZipPath: string, outputTxtPath: string): Promise<void> {
    try {
        const directory = await unzipper.Open.file(inputZipPath);

        if (directory.files.length === 0) {
            throw new Error('Zip file is empty');
        }

        // Get the first file
        const file = directory.files[0];
        const readStream = file.stream();

        // Create output stream
        const writeStream = createWriteStream(outputTxtPath);

        // If the file was gzipped during compression, decompress it
        if (file.path.endsWith('.gz')) {
            const gunzipStream = createGunzip();
            await pipelineAsync(
                readStream,
                gunzipStream,
                writeStream
            );
        } else {
            // If not gzipped, just pipe directly
            await pipelineAsync(
                readStream,
                writeStream
            );
        }
    } catch (error: any) {
        throw new Error(`Decompression failed: ${error.message}`);
    }
}
