const { readlinkSync, lstatSync } = require('fs');
const path = require('path');
const axios = require('axios')

export async function getFirstLinkpathDest(fileLink: string, sourcePath: string) {
    const response = await axios.get("http://localhost:3333", {
        params: {
            fileLink: fileLink,
            sourcePath: sourcePath
        }
    })
    return response.data
}

type TFile = {
    basename: string,
    extension: string
    name: string, 
    parent: {
        name: string,
        path: string
    },
    path: string,
    vault: {
        adapter: {
            basePath: string
        }
    },
    content: string
}

type File = {
    source: string,
    slug: string,
    path: string,
    content: string,
    full_source: string
}

/* -------------------- CONVERTERS -------------------- */

// --> Converts single file to provided final format and save back in the file
export const convertLinks = async (md: File) => {
    let fileText = md.content
    let newFileText = await convertWikiLinksToMarkdown(fileText, md)
    return newFileText
    // await fs.writeFile(mdFile.source, newFileText)
}

/* -------------------- LINKS TO MARKDOWN CONVERTER -------------------- */

// --> Converts links within given string from Wiki to MD
export const convertWikiLinksToMarkdown = async (md: string, sourceFile: File): Promise<string> => {
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
    let altText: string

    // 原链接文本
    let fileLink = decodeURI(finalLink)
    // 文件对象
    let stats = lstatSync(sourceFile.full_source)
    let filePath = stats.isSymbolicLink() ? readlinkSync(sourceFile.full_source) : sourceFile.full_source
    let file = await getFirstLinkpathDest(fileLink, filePath)

    if (dest === "markdown") {
        finalLink = getAbsoluteLink(file)
        // If there is no alt text specifiec and file exists, the alt text needs to be always the file base name
        if (altOrBlockRef !== "") {
            altText = altOrBlockRef
        } else {
            altText = file ? file.basename : finalLink
        }
        return `[${altText}](${encodeURI(finalLink)})`
    } else if (dest === 'mdTransclusion') {
        finalLink = getAbbrlink(file)
        return `<a href="/${finalLink}" data-pjax-state></a>`
        // --> To skip encoding ^
        // let encodedBlockRef = altOrBlockRef;
        // if (altOrBlockRef.startsWith('^')) {
        //     encodedBlockRef = encodeURI(encodedBlockRef.slice(1));
        //     encodedBlockRef = `^${encodedBlockRef}`;
        // } else {
        //     encodedBlockRef = encodeURI(encodedBlockRef);
        // }
        // return `[](${encodeURI(finalLink)}#${encodedBlockRef})`
    } else {
        return ""
    }
}

function getAbsoluteLink(file: TFile) {
    let fileLink: string

    fileLink = path.join(file.vault.adapter.basePath, '/', file.path)

    return fileLink
}

interface AbbrlinkMatch {
    url: string
}

function getAbbrlink(file: TFile) {
    let abbrLink: string
    let fileText = file.content

    // --> Get All WikiLinks
    let abbrlinkRegex = /abbrlink\:\s(\w+)/
    let abbrlinkMatches = fileText.match(abbrlinkRegex)

    abbrLink = abbrlinkMatches ? 'post/' + abbrlinkMatches[1] : '404'

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
                        altOrBlockRef: blockRefMatch,
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
                    altOrBlockRef: altMatch ? altMatch[0] : "",
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
                        altOrBlockRef: blockRefMatch,
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
                    altOrBlockRef: altMatch ? altMatch[0] : "",
                    // sourceFilePath: mdFile.path
                }
                linkMatches.push(linkMatch)
            }
        }
    }
    return linkMatches
}
