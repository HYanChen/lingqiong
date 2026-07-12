package org.jeecg.modules.lingqiong.controller;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.jeecg.common.api.vo.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/lingqiong/media")
public class LingqiongMediaController {
    private static final long MAX_BYTES = 8L * 1024L * 1024L;
    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png",
        "image/webp", "webp",
        "image/gif", "gif"
    );
    private static final Set<String> ALLOWED_TYPES = EXTENSIONS.keySet();
    private final Path mediaDirectory;

    public LingqiongMediaController(
        @Value("${lingqiong.media-directory}") String mediaDirectory
    ) {
        this.mediaDirectory = Path.of(mediaDirectory).normalize();
    }

    @PostMapping("/upload")
    @RequiresPermissions("lingqiong:content:edit")
    public Result<?> upload(@RequestParam("file") MultipartFile file) throws Exception {
        String type = file.getContentType();

        if (file.isEmpty() || file.getSize() > MAX_BYTES || type == null || !ALLOWED_TYPES.contains(type)) {
            return Result.error("仅支持 8MB 以内的 JPG、PNG、WebP 或 GIF 图片");
        }

        Files.createDirectories(mediaDirectory);
        String filename = UUID.randomUUID() + "." + EXTENSIONS.get(type);
        Path target = mediaDirectory.resolve(filename).normalize();

        if (!target.startsWith(mediaDirectory)) {
            return Result.error("图片路径不安全");
        }

        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return Result.OK(Map.of("url", "/media/uploads/" + filename));
    }
}
