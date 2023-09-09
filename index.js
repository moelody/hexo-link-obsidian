const { convertLinks } = require("./converter")
const path = require("path")
const fs = require("fs")
const log = require('hexo-log')({
    debug: false,
    silent: false
});

let post_render = 0;
let links = []

hexo.extend.filter.register(
    "before_post_render",
    async function (data) {
        post_render = 1;
        const config = this.config.link_obsidian
        let content = data.content
        try {
            content = data.content = await convertLinks(data, config && config.port || undefined, this.config.permalink.split(':abbrlink')[0])
        } catch (err){
            log.info('hexo-link-obsidian failed to convert', data.source, ': ', err.message)
        }

        //获取图片链接
        let absolute_images = []
        let relative_images = []
        let online_images = []
        let pattern = /!\[(.*?)\]\((.*?)\)/g
        let regImg = new RegExp(
            /\.(png|jpg|jpeg|gif|svg|ico|pdf|psd|bmp|rle|dib|tif|caw|nef|raf|orf|mrw|dcr|mos|raw|pef|srf|dng|x3f|cr2|erf|cin|dpx|gif|rla|rpf|img|el|eps|iff|tdi|pcx|hdr|rgbe|xyze|sgi|bw|rgb|pic|tga|vda|icb|vst|tif|webp)$/
        );
        let dir_root = this.base_dir
        let dir_source = this.source_dir
        let dir_public = this.public_dir
        let dir_images = path.join(dir_public, data.path, "images")

        while ((matchs = pattern.exec(data.content)) != null) {
            let match = matchs[0]
            let title = matchs[1]
            let url = matchs[2]
            let ourl = url
            if (url[0] == '/' || url[0] == '~' || url[1] == ':') {
                absolute_images.push(url)
            } else if (/^http/.test(url))
            {
                if (regImg.test(url))
                {
                    online_images.push(url)
                } else
                {
                    let size = ~title.indexOf("|") ? title.split("|").pop().split("x") : [720, 360]
                    content = content.replace(match, convertOnlineMediaEmbedLink(url, size))
                }
                continue;
            } else if (url) {
                relative_images.push(url)
                url = path.join(path.dirname(data.asset_dir), url)
            }

            let filePath = decodeURI(url)
            await dirExists(dir_images)
            links = links.concat(absolute_images).concat(relative_images)
            fs.copyFileSync(filePath, path.join(dir_images, path.basename(filePath)))

            if ([".mp4", ".webm", ".ogg"].includes(path.extname(filePath))) {
                content = content.replace(match, encodeURI("images/" + path.basename(filePath)))
            } else {
                content = content.replace(ourl, encodeURI("images/" + path.basename(filePath)))
            }
        }
        data.content = content

        return data
    },
    1
)

hexo.extend.filter.register(
    "before_exit",
    async function () {
        
        post_render && log.info(`hexo-link-obsidian Convert && Copy ${links.length} wikiLink files success!`)

    },
    1
)


/* -------------------- CONVERTER Online Media Embed Link -------------------- */

function convertOnlineMediaEmbedLink(src, size = [720, 360]) {
    src = new URL(src)

    switch (src.hostname) {
        case "www.bilibili.com":
            if (src.pathname.startsWith("/video")) {
                let videoId = src.pathname.replace("/video/", "")
                let queryStr = ''
                if (/^bv/i.test(videoId)) {
                    queryStr = `?bvid=${videoId}`
                } else if (/^av/i.test(videoId)) {
                    videoId = videoId.substring(2)
                    queryStr = `?aid=${videoId}`
                } else {
                    console.log(`invaild bilibili video id: ${videoId}`)
                    return null
                }
                let page = src.searchParams.get("p")
                if (page) queryStr += `&page=${page}`
                return `<iframe width="${size[0]}" height="${size[1]}" src="https://player.bilibili.com/player.html${queryStr}&high_quality=1&danmaku=0&as_wide=1&" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" class="bili-iframe"> </iframe>`
            }
            break;
        case "youtube.com":
        case "www.youtube.com":
        case "youtu.be":
            if (src.pathname === "/watch") {
                let videoId = src.searchParams.get("v")
                if (videoId) {
                    return `<iframe width="${size[0]}" height="${size[1]}" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                } else {
                    console.log(`invalid youtube video id: ${src.toString()}`)
                    return null
                }
            } else if (src.host === "youtu.be") {
                if (/^\/[^\/]+$/.test(src.pathname)) {
                    let videoId = src.pathname.substring(1)
                    return `<iframe width="${size[0]}" height="${size[1]}" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                } else {
                    console.log(`invalid youtube video id: ${src.toString()}`)
                    return null
                }
            } else {
                console.log("youtube video url not supported or invalid")
                return null
            }
            break
        case "vimeo.com":
            const path = src.pathname
            let match
            if ((match = path.match(/^\/(\d+)$/))) {
                let videoId = match[1]
                return `<iframe width="${size[0]}" height="${size[1]}" src="https://player.vimeo.com/video/${videoId}" frameborder="0" fullscreen; picture-in-picture" allowfullscreen></iframe>`
            } else {
                console.log("vimeo video url not supported or invalid")
                return null
            }
        default:
            return null
    }
}

/* -------------------- 文件目录生成 -------------------- */

/**
 * 读取路径信息
 * @param {string} path 路径
 */
function getStat(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err) {
                resolve(false)
            } else {
                resolve(stats)
            }
        })
    })
}

/**
 * 创建路径
 * @param {string} dir 路径
 */
function mkdir(dir) {
    return new Promise((resolve, reject) => {
        fs.mkdir(dir, err => {
            if (err) {
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}

/**
 * 路径是否存在，不存在则创建
 * @param {string} dir 路径
 */
async function dirExists(dir) {
    let isExists = await getStat(dir)
    //如果该路径且不是文件，返回true
    if (isExists && isExists.isDirectory()) {
        return true
    } else if (isExists) {
        //如果该路径存在但是文件，返回false
        return false
    }
    //如果该路径不存在，拿到上级路径
    let tempDir = path.parse(dir).dir
    //递归判断，如果上级目录也不存在，则会代码会在此处继续循环执行，直到目录存在
    let status = await dirExists(tempDir)
    let mkdirStatus
    if (status) {
        mkdirStatus = await mkdir(dir)
    }
    return mkdirStatus
}
