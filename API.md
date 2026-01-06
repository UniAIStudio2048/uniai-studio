我需要在这个网址下调用Nano-banana(Edits兼容)模型
https://ai.comfly.chat/api-set
参考这张图片
/home/devbox/project/a3346c35758fd4e37805d5c4e6d1054a.png
把每个模型区分开，模型分为：Nano Banana 2,Nano Banana 1 HD,Nano Banana 1三个模型
文生图和图生图的出图方法也要分开，当上传图片时选用图生图的出图方式，当不上传图片是就采用文生图的出图方式
文生图的请求示例
{
    "prompt": "一只戴着太空头盔的猫，漂浮在绚丽的星云中，数字艺术风格",
    "model": "nano-banana-2",
    "aspect_ratio": "16:9",
    "response_format": "url",
    "image_size": "2K"
}
文生图的返回示例
{"created":1763965223,"data":[{"revised_prompt":"一只戴着太空头盔的猫，漂浮在绚丽的星云中，数字艺术风格","url":"https://webstatic.aiproxy.vip/output/20251124/572e455a-e00a-4084-8b5f-1b3a8bded46e.png"}],"model":"nano-banana-2","usage":{"prompt_tokens":36,"completion_tokens":1408,"total_tokens":1444,"input_tokens":36,"output_tokens":1408}}
图生图的请求示例
curl --location --request POST 'https://ai.comfly.chat/v1/images/generations'
--header 'Authorization: Bearer sk-sXuHFUJXkha2qTTqF5Bc52E9Cc484b7b861dC863340cB37b'
--header 'Content-Type: application/json'
--data-raw '{
"prompt": "将天气变为雨天",
"model": "nano-banana-2",
"aspect_ratio": "1:1",
"response_format": "url",
"image_size": "2K",
"image": [
"https://rh-images.xiaoyaoyou.com/275c1a72762b467268c51d44810cf6a0/output/Mixlab_00001_sjdfm_1763878753.png"
]
}'
图生图的返回示例
{"created":1763965989,"data":[{"revised_prompt":"将天气变为雨天","url":"https://webstatic.aiproxy.vip/output/20251124/c246c016-940e-4bac-8256-33c5a3095f2b.png"}],"model":"nano-banana-2","usage":{"prompt_tokens":277,"completion_tokens":1390,"total_tokens":1667,"input_tokens":277,"output_tokens":1390}}