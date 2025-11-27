"use client";

import type { TextItem } from "pdfjs-dist/types/src/display/api";

type PdfTextContent = {
  items: TextItem[];
};

type PdfPage = {
  getTextContent: () => Promise<PdfTextContent>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<PdfDocument>;
  };
};

export async function extractTextFromPdf(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only supported in the browser");
  }

  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
  // Use local worker file from public directory
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item: TextItem | { str?: string }) =>
        "str" in item ? item.str ?? "" : ""
      )
      .join(" ");
    text += `${line}\n`;
  }

  return text.trim();
}
