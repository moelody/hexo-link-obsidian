# hexo-link-obsidian
![node](https://img.shields.io/badge/node-%3E%3D10.0.0-green.svg)

此插件须配合Obsidian插件使用[link-to-obsidian](https://github.com/moelody/link-to-obsidian)

Hexo 博客插件，插件将自动请求ob插件以处理_posts中所有文档（包括符号链接的文档）的wiki链接，各类型文件的处理方式如下：
- .md 根据文档内容里 `abbrlink: <link>` 的永久链接生成 `<a href="/post/<link>#<encodedBlockRef>" data-pjax-state></a>` 文章链接的形式
- .png/jpg/jpeg/gif 常用图片格式文件将被复制到该文章生成目录下的images目录下，并将链接转化为其相对路径链接
- .mp4/webm/ogg video标签支持的视频格式文件将被复制到该文章生成目录下的images目录下，并将链接转化为其相对路径链接，wiki链接的嵌入符号# `*.mp4#position= "absolute" width="100%" height="100%" controls="controls"` 后文字可作为video标签属性被应用
- .* 其他类型文件将被转为常规md形式`[]()`，更多格式支持欢迎提issue

### 安装

```bash
npm i hexo-link-obsidian -s
yarn add hexo-link-obsidian
```

### 自定义配置

以下配置非必需，在 `your-hexo-project/_config.yml 或 _multiconfig.yml` 添加。

```yml
# Link Obsidian
easy_images:
  port: 3333 # 必须和obsidian插件中的端口相匹配 Must be same as link-to-obsidian server port
```
