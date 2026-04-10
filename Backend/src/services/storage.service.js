const ImageKit = require("@imagekit/nodejs").default

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || process.env.IMAGEKIT_PUBLIC_KEY

const client = new ImageKit({
    privateKey,
})

async function uploadFile({ buffer, filename, folder = "", mimeType }) {
    const file = await client.files.upload({
        file: await ImageKit.toFile(Buffer.from(buffer), filename, mimeType ? { type: mimeType } : undefined),
        fileName: filename,
        folder
    })

    return file

}

module.exports = { uploadFile }
