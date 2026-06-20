import { useState } from "react";
import Tesseract from "tesseract.js";

// Helper chuyển đổi chuỗi thời gian linh hoạt sang giây
function hhmmssToSecs(val: string): number {
  if (!val.trim()) return 0;
  const parts = val.split(":");
  
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

export function useOcrTime() {
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const processImage = async (file: File): Promise<number[]> => {
    try {
      setIsOcrLoading(true);

      // Nhận diện ký tự từ hình ảnh
      const result = await Tesseract.recognize(file, "eng");
      const rawText = result.data.text;

      // Chuẩn hóa văn bản: đổi các ký tự xuống dòng, tab thành khoảng trắng thông thường
      const normalizedText = rawText.replace(/\s+/g, " ");

      // Tách chuỗi thành mảng dựa trên khoảng trắng
      const rawTokens = normalizedText.split(" ");

      const secondsArray: number[] = [];

      for (const token of rawTokens) {
        // Lọc sạch token: chỉ giữ lại số và dấu hai chấm
        const cleanedToken = token.replace(/[^0-9:]/g, "").trim();
        
        // Điều kiện hợp lệ: Token phải có ít nhất 1 số và chứa dấu ":"
        if (cleanedToken && cleanedToken.includes(":") && /[0-9]/.test(cleanedToken)) {
          const seconds = hhmmssToSecs(cleanedToken);
          secondsArray.push(seconds);
        }
      }

      if (secondsArray.length === 0) {
        alert("Không tìm thấy bất kỳ khối thời gian hợp lệ nào (Ví dụ: 42:24, 1:52:55) trong hình ảnh!");
      }

      return secondsArray;
    } catch (error) {
      console.error("Lỗi khi quét ảnh OCR:", error);
      alert("Đã xảy ra lỗi hệ thống khi quét phân tích hình ảnh.");
      return [];
    } finally {
      setIsOcrLoading(false);
    }
  };

  return {
    processImage,
    isOcrLoading,
  };
}