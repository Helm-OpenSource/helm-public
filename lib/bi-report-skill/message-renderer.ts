type RenderContext = Record<string, unknown> & {
  __currentItem?: unknown;
};

export function renderBiReportMessage(template: string, context: Record<string, unknown>) {
  return renderTemplate(template, context).trim();
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  const withLoops = template.replace(
    /{{#([\w.]+)}}([\s\S]*?){{\/\1}}/g,
    (_match: string, rawPath: string, block: string): string => {
      const collection = resolvePath(context as RenderContext, rawPath);
      if (!Array.isArray(collection) || collection.length === 0) {
        return "";
      }

      return collection
        .map((item): string => {
          const scopedContext: RenderContext =
            item && typeof item === "object"
              ? { ...(context as RenderContext), ...(item as Record<string, unknown>), __currentItem: item }
              : { ...(context as RenderContext), __currentItem: item };
          return renderTemplate(block, scopedContext);
        })
        .join("");
    },
  );

  return withLoops.replace(/{{\s*([\w.]+|\.)\s*}}/g, (_match: string, rawPath: string): string => {
    const value = resolvePath(context as RenderContext, rawPath);
    return value == null ? "" : String(value);
  });
}

function resolvePath(context: RenderContext, rawPath: string): unknown {
  if (rawPath === ".") {
    return context.__currentItem;
  }

  return rawPath.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, context);
}
