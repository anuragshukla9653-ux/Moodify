const ImageKit = require("@imagekit/nodejs").default

let client = null

function getClient() {
    if (client) {
        return client
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY

    if (!privateKey) {
        throw new Error("IMAGEKIT_PRIVATE_KEY is required to upload files")
    }

    client = new ImageKit({
        privateKey,
    })

    return client
}

async function uploadFile({ buffer, filename, folder = "", mimeType }) {
    const file = await getClient().files.upload({
        file: await ImageKit.toFile(Buffer.from(buffer), filename, mimeType ? { type: mimeType } : undefined),
        fileName: filename,
        folder
    })

    return file

}

module.exports = { uploadFile }
