package org.jeecg.modules.lingqiong.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/lingqiong/bridge")
public class LingqiongPlatformBridgeController {
    private static final List<String> ALLOWED_PREFIXES = List.of(
        "/admin/", "/account/", "/knowledge/", "/projects", "/project-types",
        "/models/available", "/skills"
    );

    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    private final String platformApiUrl;
    private final String serviceSecret;

    public LingqiongPlatformBridgeController(
        @Value("${lingqiong.platform-api-url}") String platformApiUrl,
        @Value("${lingqiong.service-secret}") String serviceSecret
    ) {
        this.platformApiUrl = platformApiUrl.replaceAll("/+$", "");
        this.serviceSecret = serviceSecret;
    }

    @RequestMapping("/**")
    @RequiresPermissions("lingqiong:bridge:use")
    public ResponseEntity<String> bridge(
        HttpServletRequest request,
        @RequestBody(required = false) String body
    ) throws Exception {
        String requestUri = request.getRequestURI();
        String marker = "/lingqiong/bridge";
        String path = requestUri.substring(requestUri.indexOf(marker) + marker.length());

        if (path.isBlank() || ALLOWED_PREFIXES.stream().noneMatch(path::startsWith)) {
            return ResponseEntity.status(404).body("{\"message\":\"不支持的后台业务接口\"}");
        }

        String query = request.getQueryString();
        URI target = URI.create(platformApiUrl + path + (query == null ? "" : "?" + query));
        HttpRequest.BodyPublisher publisher = body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest.Builder builder = HttpRequest.newBuilder(target)
            .timeout(Duration.ofSeconds(30))
            .header("Accept", "application/json")
            .header("Content-Type", request.getContentType() == null
                ? MediaType.APPLICATION_JSON_VALUE
                : request.getContentType())
            .header("X-Lingqiong-Service-Secret", serviceSecret)
            .method(request.getMethod(), publisher);
        HttpResponse<String> response = client.send(
            builder.build(),
            HttpResponse.BodyHandlers.ofString()
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        return new ResponseEntity<>(
            response.body(),
            headers,
            HttpStatusCode.valueOf(response.statusCode())
        );
    }
}
