export const extractMegaId = (input) => {
  try {
    const regex = /folder\/([^#]+)/;
    const match = input.match(regex)?.[1];
    return match || null;
  } catch {
    return null;
  }
};

export const cleanGoogleLink = (link) => {
  return link.replace("https://www.google.com/url?q=", "").split("&")[0];
};
