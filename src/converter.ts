// @ts-ignore
const { readlinkSync, lstatSync } = require("fs")
// @ts-ignore
const path = require("path")
// @ts-ignore
const axios = require("axios")

type TFile = {
    basename: string
    extension: string
    name: string
    parent: {
        name: string
        path: string
    }
    path: string
    vault: {
        adapter: {
            basePath: string
        }
    }
    content: string
}

type File = {
    source: string
    slug: string
    path: string
    content: string
    full_source: string
}

/* -------------------- connect to obsidian -------------------- */

let linkPort = 3333
// @ts-ignore
export async function getFirstLinkpathDest(fileLink: string, sourcePath: string) {
    const response = await axios.get(`http://localhost:${linkPort}`, {
        params: {
            fileLink: fileLink,
            sourcePath: sourcePath
        },
        timeout: 1000
    })

    return response.data
}

/* -------------------- CONVERTERS -------------------- */
let permalink = 'posts/'
// --> Converts single file to provided final format and save back in the file
export const convertLinks = async (md: File, port: number = linkPort, permal: string = permalink) => {
    linkPort = port
    permalink = permal
    let fileText = md.content
    let newFileText = convertCommentSymbol(fileText)
    newFileText = await convertWikiLinksToMarkdown(fileText, md)
    return newFileText
    // await fs.writeFile(mdFile.source, newFileText)
}

// %% Comment Convert %%
const convertCommentSymbol = (md: string) => {
    let newMdText = md

    // --> Get All %% %%
    let commentRegex = /^abbrlink\:\s*(\w+)/g
    let commentMatches = newMdText.match(commentRegex)

    commentMatches && (newMdText = newMdText.replace(commentMatches[0], ""))

    return newMdText
}

/* -------------------- LINKS TO MARKDOWN CONVERTER -------------------- */

// --> Converts links within given string from Wiki to MD
const convertWikiLinksToMarkdown = async (md: string, sourceFile: File): Promise<string> => {
    let newMdText = md
    let linkMatches: LinkMatch[] = getAllLinkMatchesInFile(md)
    // --> Convert Wiki Internal Links to Markdown Link
    let wikiMatches = linkMatches.filter(match => match.type === "wiki")
    for (let wikiMatch of wikiMatches) {
        let mdLink = await createLink("markdown", wikiMatch.linkText, wikiMatch.altOrBlockRef, sourceFile)
        newMdText = newMdText.replace(wikiMatch.match, mdLink)
    }
    // --> Convert Wiki Transclusion Links to Markdown Transclusion
    let wikiTransclusions = linkMatches.filter(match => match.type === "wikiTransclusion")
    for (let wikiTransclusion of wikiTransclusions) {
        let wikiTransclusionLink = await createLink("mdTransclusion", wikiTransclusion.linkText, wikiTransclusion.altOrBlockRef, sourceFile)

        newMdText = newMdText.replace(wikiTransclusion.match, wikiTransclusionLink)
    }
    return newMdText
}

/* -------------------- HELPERS -------------------- */

const createLink = async (dest: LinkType, originalLink: string, altOrBlockRef: string, sourceFile: File) => {
    let finalLink = originalLink
    let altText = ""
    let encodedBlockRef = ""

    // 原链接文本
    let fileLink = decodeURI(finalLink)
    // 文件对象
    let stats = lstatSync(sourceFile.full_source)
    let filePath = stats.isSymbolicLink() ? readlinkSync(sourceFile.full_source) : sourceFile.full_source
    let file = await getFirstLinkpathDest(fileLink, filePath)

    finalLink = file.extension === "md" ? getAbbrlink(file) : getAbsoluteLink(file)
    
    // 以‘|’分割别名
    let altOrBlockRefContainVerticalBar = altOrBlockRef.search(/\|/)
    let altTextSource = altOrBlockRef
    let altOrBlockRefSource = altOrBlockRef

    if (altOrBlockRefContainVerticalBar != -1){
        altOrBlockRefSource = altOrBlockRef.split('|')[0]
        altTextSource = altOrBlockRef.split('|')[1]
    }

    if (altTextSource !== "") {
        altText = altTextSource
    } else {
        altText = file ? file.basename : finalLink
    }

    if (dest === "mdTransclusion") {
        // --> To skip encoding ^
        encodedBlockRef = altOrBlockRefSource
        if (altOrBlockRef.startsWith("^")) {
            encodedBlockRef = encodeURI(encodedBlockRef.slice(1))
            encodedBlockRef = `^${encodedBlockRef}`
        } else {
            encodedBlockRef = encodeURI(encodedBlockRef)
        }
    }

    if (["md"].includes(file.extension)) {
        return `<a href="/${finalLink}${encodedBlockRef && "#" + encodedBlockRef}" data-pjax-state target="_Blank">${altText}</a>`
    } else if (["png", "jpg", "jpeg", "gif"].includes(file.extension)) {
        return `![${altText}](${encodeURI(finalLink)})`
    } else if (["mp4", "webm", "ogg"].includes(file.extension)) {
        return `<video src="![](${encodeURI(finalLink)})" ${decodeURI(encodedBlockRef)}></video>`
    } else {
        return `[${altText}](${encodeURI(finalLink)})`
    }
}

function getAbsoluteLink(file: TFile) {
    let fileLink: string

    fileLink = path.join(file.vault.adapter.basePath, "/", file.path)

    return fileLink
}

function getAbbrlink(file: TFile) {
    let abbrLink: string
    let fileText = file.content

    let abbrlinkRegex = /^abbrlink\:\s*([\'\"])*(\w+)\1+?/m
    let abbrlinkMatches = fileText.match(abbrlinkRegex)

    abbrLink = abbrlinkMatches ? permalink + abbrlinkMatches[2] : "404"

    return abbrLink
}

/* -------------------- LINK DETECTOR -------------------- */

type LinkType = "markdown" | "wiki" | "wikiTransclusion" | "mdTransclusion"

interface LinkMatch {
    type: LinkType
    match: string
    linkText: string
    altOrBlockRef: string
    // sourceFilePath: string
}

/* -------------------- TRANSCLUSIONS -------------------- */

const wikiTransclusionRegex = /\[\[(.*?)#.*?\]\]/
const wikiTransclusionFileNameRegex = /(?<=\[\[)(.*)(?=#)/
const wikiTransclusionBlockRef = /(?<=#).*?(?=]])/

const mdTransclusionRegex = /\[.*?]\((.*?)#.*?\)/
const mdTransclusionFileNameRegex = /(?<=\]\()(.*)(?=#)/
const mdTransclusionBlockRef = /(?<=#).*?(?=\))/

const matchIsWikiTransclusion = (match: string): boolean => {
    return wikiTransclusionRegex.test(match)
}

const matchIsMdTransclusion = (match: string): boolean => {
    return mdTransclusionRegex.test(match)
}

/**
 * @param match
 * @returns file name if there is a match or empty string if no match
 */
const getTransclusionFileName = (match: string): string => {
    let isWiki = wikiTransclusionRegex.test(match)
    let isMd = mdTransclusionRegex.test(match)
    if (isWiki || isMd) {
        let fileNameMatch = match.match(isWiki ? wikiTransclusionFileNameRegex : mdTransclusionFileNameRegex)
        if (fileNameMatch) return fileNameMatch[0]
    }
    return ""
}

/**
 * @param match
 * @returns block ref if there is a match or empty string if no match
 */
const getTransclusionBlockRef = (match: string) => {
    let isWiki = wikiTransclusionRegex.test(match)
    let isMd = mdTransclusionRegex.test(match)
    if (isWiki || isMd) {
        let blockRefMatch = match.match(isWiki ? wikiTransclusionBlockRef : mdTransclusionBlockRef)
        if (blockRefMatch) return blockRefMatch[0]
    }
    return ""
}

const getAllLinkMatchesInFile = (md: string): LinkMatch[] => {
    const linkMatches: LinkMatch[] = []
    let fileText = md

    // --> Get All WikiLinks
    let wikiRegex = /\!*\[\[.*?\]\]/g
    let wikiMatches = fileText.match(wikiRegex)

    if (wikiMatches) {
        let fileRegex = /(?<=\[\[).*?(?=(\]|\|))/
        let altRegex = /(?<=\|).*(?=]])/

        for (let wikiMatch of wikiMatches) {
            // --> Check if it is Transclusion
            if (matchIsWikiTransclusion(wikiMatch)) {
                let fileName = getTransclusionFileName(wikiMatch)
                let blockRefMatch = getTransclusionBlockRef(wikiMatch)
                if (fileName !== "" && blockRefMatch !== "") {
                    let linkMatch: LinkMatch = {
                        type: "wikiTransclusion",
                        match: wikiMatch,
                        linkText: fileName,
                        altOrBlockRef: blockRefMatch
                        // sourceFilePath: mdFile.path
                    }
                    linkMatches.push(linkMatch)
                    continue
                }
            }
            // --> Normal Internal Link
            let fileMatch = wikiMatch.match(fileRegex)
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith("http")) continue
                let altMatch = wikiMatch.match(altRegex)
                let linkMatch: LinkMatch = {
                    type: "wiki",
                    match: wikiMatch,
                    linkText: fileMatch[0],
                    altOrBlockRef: altMatch ? altMatch[0] : ""
                    // sourceFilePath: mdFile.path
                }
                linkMatches.push(linkMatch)
            }
        }
    }

    // --> Get All Markdown Links
    let markdownRegex = /\[(^$|.*?)\]\((.*?)\)/g
    let markdownMatches = fileText.match(markdownRegex)

    if (markdownMatches) {
        let fileRegex = /(?<=\().*(?=\))/
        let altRegex = /(?<=\[)(^$|.*?)(?=\])/
        for (let markdownMatch of markdownMatches) {
            // --> Check if it is Transclusion
            if (matchIsMdTransclusion(markdownMatch)) {
                let fileName = getTransclusionFileName(markdownMatch)
                let blockRefMatch = getTransclusionBlockRef(markdownMatch)
                if (fileName !== "" && blockRefMatch !== "") {
                    let linkMatch: LinkMatch = {
                        type: "mdTransclusion",
                        match: markdownMatch,
                        linkText: fileName,
                        altOrBlockRef: blockRefMatch
                        // sourceFilePath: mdFile.path
                    }
                    linkMatches.push(linkMatch)
                    continue
                }
            }
            // --> Normal Internal Link
            let fileMatch = markdownMatch.match(fileRegex)
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith("http")) continue
                let altMatch = markdownMatch.match(altRegex)
                let linkMatch: LinkMatch = {
                    type: "markdown",
                    match: markdownMatch,
                    linkText: fileMatch[0],
                    altOrBlockRef: altMatch ? altMatch[0] : ""
                    // sourceFilePath: mdFile.path
                }
                linkMatches.push(linkMatch)
            }
        }
    }
    return linkMatches
}
