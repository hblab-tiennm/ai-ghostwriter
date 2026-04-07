import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Joon Idelisa",
  description:
    "Công cụ AI ghostwriter chuyên viết nội dung bất động sản cho FUTA Land. Tạo bài Facebook, bài báo, phân tích thị trường với giọng văn thương hiệu chuẩn.",
  keywords: ["FUTA Land", "ghostwriter", "AI viết nội dung", "bất động sản", "content marketing"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
