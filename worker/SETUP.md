# Setup: Hỏi Đáp qua Telegram + Email tự động

Hướng dẫn deploy backend cho form "Hỏi Đáp" trên web. Làm 1 lần, mất khoảng 20-30 phút.

## 0. Huỷ token Telegram đã lộ (bắt buộc, làm trước tiên)

Token bạn gửi trong chat đã bị lộ. Trên Telegram, mở chat với **@BotFather**, gõ:

```
/mybots
```

Chọn bot của bạn → **Bot Settings** → **Revoke current token** (hoặc gõ `/revoke`). Copy token MỚI, dùng token này ở bước 4 bên dưới. Không dán token vào chat với Claude hay bất kỳ đâu công khai.

## 1. Cài công cụ

Cần Node.js (đã cài sẵn trên máy bạn). Mở Terminal, chạy:

```bash
cd worker
npm install -g wrangler
wrangler login
```

Lệnh cuối mở trình duyệt để bạn đăng nhập/tạo tài khoản Cloudflare (miễn phí).

## 2. Tạo KV namespace (nơi lưu câu hỏi tạm thời)

```bash
wrangler kv namespace create QUESTIONS
```

Lệnh này in ra 1 đoạn có dạng:

```
id = "abc123..."
```

Mở file `worker/wrangler.toml`, thay `REPLACE_ME` bằng id thật đó.

## 3. Đăng ký Resend (dịch vụ gửi email, miễn phí 3.000 email/tháng)

Vào [resend.com](https://resend.com), đăng ký tài khoản, vào **API Keys** → **Create API Key**, copy key (dạng `re_...`). Không cần verify domain riêng, dùng domain test mặc định của Resend vẫn gửi được tới bất kỳ email nào.

## 4. Lấy Telegram chat_id của bạn

Trên Telegram, tự nhắn 1 tin bất kỳ cho bot của bạn (ví dụ "hi"). Sau đó mở trình duyệt, truy cập (thay `<TOKEN>` bằng token MỚI ở bước 0):

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

Tìm số ở `"chat":{"id": ...}` trong kết quả trả về, đó là chat_id của bạn.

## 5. Nhập các secret cho Worker

Trong thư mục `worker/`, chạy lần lượt (mỗi lệnh sẽ hỏi bạn paste giá trị vào, không hiện ra màn hình):

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put RESEND_API_KEY
wrangler secret put ALLOWED_ORIGIN
```

Giá trị cho từng lệnh:
- `TELEGRAM_BOT_TOKEN`: token mới từ bước 0
- `TELEGRAM_CHAT_ID`: số từ bước 4
- `RESEND_API_KEY`: key từ bước 3
- `ALLOWED_ORIGIN`: `https://uyenthy-dinh.github.io`

## 6. Deploy

```bash
wrangler deploy
```

Kết quả in ra 1 URL dạng:

```
https://belinda-hoi-dap.<your-subdomain>.workers.dev
```

Copy URL này.

## 7. Đăng ký webhook cho Telegram

Mở trình duyệt, truy cập (thay `<TOKEN>` và `<WORKER_URL>` bằng giá trị thật):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/telegram-webhook
```

Thấy `"ok":true` là xong. Từ giờ khi bạn reply tin nhắn câu hỏi trong Telegram, hệ thống tự gửi email cho người hỏi.

## 8. Nối vào web

Mở file `hoi-dap.html` ở thư mục gốc repo, tìm dòng:

```js
const WORKER_URL = "REPLACE_WITH_YOUR_WORKER_URL";
```

Thay bằng URL thật ở bước 6 (giữ nguyên không có dấu `/` ở cuối). Commit và push lên GitHub là xong.

## Cách hoạt động

1. Khách vào `hoi-dap.html`, điền tên/email/câu hỏi, bấm gửi.
2. Worker tự gọi Cloudflare Workers AI soạn 1 bản **nháp** trả lời (miễn phí, không cần đăng ký gì thêm, đã bật sẵn qua khối `[ai]` trong `wrangler.toml`).
3. Bạn nhận 1 tin nhắn Telegram gồm: câu hỏi + bản nháp AI.
4. Bạn đọc, sửa lại nháp cho đúng ý (hoặc viết lại hoàn toàn), muốn kèm link sản phẩm thì tự dán vào. Sau đó **reply** tin nhắn đó với bản trả lời cuối cùng.
5. Hệ thống tự gửi email câu trả lời đó cho người hỏi, và báo lại cho bạn trong Telegram khi gửi xong.

Lưu ý: Workers AI dùng model mã nguồn mở (Llama), không phải Claude — chất lượng nháp ở mức tham khảo, luôn đọc lại trước khi gửi. Nếu 1 ngày có quá nhiều câu hỏi vượt hạn mức miễn phí của Workers AI, bước soạn nháp sẽ tự bỏ qua (báo "AI soạn nháp thất bại"), phần gửi email vẫn hoạt động bình thường khi bạn tự gõ câu trả lời.

## Về sau nếu cần sửa

Sửa code trong `worker/src/index.js` xong, chạy lại `wrangler deploy` trong thư mục `worker/` là cập nhật.
