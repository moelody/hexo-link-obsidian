const { convertLinks } = require("./converter")
const path = require("path")
const fs = require("fs")

hexo.extend.filter.register(
    "before_post_render",
    async function (data) {
        let content = (data.content = await convertLinks(data))

        //获取图片链接
        let pattern = /\[.*?\]\((.*?)\)/g
        let dir_root = this.base_dir
        let dir_source = this.source_dir
        let dir_public = this.public_dir
        let dir_images = path.join(dir_public, data.path, "images")

        while ((match = pattern.exec(content)) != null) {
            let filePath = decodeURI(match[1])
            await dirExists(dir_images)
            fs.copyFileSync(filePath, path.join(dir_images, path.basename(filePath)))
        }

        return data
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

// const diff_list = []

// hexo.extend.filter.register(
//     "before_post_render",
//     async function (data) {
//         let content = (data.content = await convertLinks(data))

//         //获取图片链接
//         let diff = {
//             parent: data.path,
//             links: []
//         }
//         let pattern = /\[.*?\]\((.*?)\)/g

//         while ((match = pattern.exec(content)) != null) {
//             diff.links.push(match[1])
//         }

//         diff_list.push(diff)

//         return data
//     },
//     1
// )

// hexo.extend.filter.register(
//     "before_exit",
//     async function () {
//         let dir_root = this.base_dir
//         let dir_source = this.source_dir
//         let dir_public = this.public_dir
//         if (diff_list) {
//             diff_list.forEach(function(diff){
//                 let { parent, links } = diff
//                 // 复制到Public目录下
//                 let dir_images = path.join(dir_public, parent, 'images')
//                 diff.links.forEach(function(link){
//                     let filePath = decodeURI(link)
//                     console.log(filePath)
//                     // console.log(fs.existsSync(path.join(dir_public, path.basename(filePath))))
//                     fs.copyFileSync(filePath, path.join(dir_images, path.basename(filePath)))
//                 })
//             })
//         }
//     },
//     1
// )

/* 
_Document {
    _content: '>动态设计中也常用到曲线，重要的是熟悉基础理论和熟悉各种事物的运动规律。比如人物的走路方式也分情感\n' +
        '\n' +
        '![[feat#test]]\n' +
        '\n' +
        '### 中间关键帧漂浮穿梭\n' +
        '![[黄金眼瞳女.png]]\n',
    source: '_posts/合成漫画 1.md',
    raw: '>动态设计中也常用到曲线，重要的是熟悉基础理论和熟悉各种事物的运动规律。比如人物的走路方式也分情感\n' +
        '\n' +
        '![[feat#test]]\n' +
        '\n' +
        '### 中间关键帧漂浮穿梭\n' +
        '![[黄金眼瞳女.png]]\n',
    slug: '合成漫画 1',
    published: true,
    date: Moment<2022-01-11T09:58:39+08:00>,
    updated: Moment<2022-01-12T10:58:41+08:00>,
    title: '',
    comments: true,
    layout: 'post',
    photos: [],
    link: '',
    _id: 'ckyaz5hwm00009k5hhalgdfs2',
    path: [Getter],
    permalink: [Getter],
    full_source: [Getter],
    asset_dir: [Getter],
    tags: [Getter],
    categories: [Getter],
    content: '>动态设计中也常用到曲线，重要的是熟悉基础理论和熟悉各种事物的运动规律。比如人物的走路方式也分情感\n' +
        '\n' +
        '![[feat#test]]\n' +
        '\n' +
        '### 中间关键帧漂浮穿梭\n' +
        '![[黄金眼瞳女.png]]\n',
    site: { data: {} }
    }
*/
