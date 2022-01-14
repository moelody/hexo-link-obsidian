const { convertLinks } = require("./converter")
const path = require("path")
const fs = require("fs")
const log = require('hexo-log')({
    debug: false,
    silent: false
});

let post_render = 0;
let info = 1;
let links = []

hexo.extend.filter.register(
    "before_post_render",
    async function (data) {
        post_render = 1;
        const config = this.config.link_obsidian
        let content = data.content
        try {
            content = data.content = await convertLinks(data, config?.port)
        } catch (err){
            log.info('Failed to link obsidian port', err.message)
            info = 1
        }

        //获取图片链接
        let absolute_images = []
        let relative_images = []
        let online_images = []
        let pattern = /!\[.*?\]\((.*?)\)/g
        let dir_root = this.base_dir
        let dir_source = this.source_dir
        let dir_public = this.public_dir
        let dir_images = path.join(dir_public, data.path, "images")

        while ((matchs = pattern.exec(data.content)) != null) {
            let match = matchs[0]
            let url = matchs[1]
            let ourl = url
            if (url[0] == '/' || url[0] == '~' || url[1] == ':') {
                absolute_images.push(url)
            } else if (/^http/.test(url)) {
                online_images.push(url)
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
        
        post_render && log.info(`Convert && Copy ${links.length} wikiLink files ${info?'success':'error'}!`)

    },
    1
)
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
