import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; type: "embed" | "upload" }) => ReturnType;
    };
  }
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Bilibili
  const biliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  if (biliMatch) return `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&high_quality=1`;

  return null;
}

function VideoComponent({ node }: { node: { attrs: Record<string, unknown> } }) {
  const src = node.attrs.src as string;
  const type = node.attrs.type as string;

  if (type === "embed") {
    const embedUrl = getEmbedUrl(src) || src;
    return (
      <NodeViewWrapper>
        <div className="video-embed-wrapper">
          <iframe
            src={embedUrl}
            className="video-embed"
            frameBorder="0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="嵌入视频"
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="video-upload-wrapper">
        <video
          src={src}
          controls
          className="video-upload"
        />
      </div>
    </NodeViewWrapper>
  );
}

export const VideoExtension = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      type: { default: "upload" },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="video-embed"]' },
      { tag: 'div[data-type="video-upload"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes.type || "upload";
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": `video-${type}` })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoComponent);
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
