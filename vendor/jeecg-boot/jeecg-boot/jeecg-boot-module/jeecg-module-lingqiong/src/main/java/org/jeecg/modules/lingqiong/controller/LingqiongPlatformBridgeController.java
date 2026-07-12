package org.jeecg.modules.lingqiong.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.jeecg.common.api.vo.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/lingqiong/bridge")
public class LingqiongPlatformBridgeController {
    private static final List<String> ALLOWED_PREFIXES = List.of(
        "/admin/", "/account/", "/knowledge/", "/projects", "/project-types",
        "/models/available", "/skills"
    );

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();
    private final String platformApiUrl;
    private final String serviceSecret;

    public LingqiongPlatformBridgeController(
        ObjectMapper objectMapper,
        @Value("${lingqiong.platform-api-url}") String platformApiUrl,
        @Value("${lingqiong.service-secret}") String serviceSecret
    ) {
        this.objectMapper = objectMapper;
        this.platformApiUrl = platformApiUrl.replaceAll("/+$", "");
        this.serviceSecret = serviceSecret;
    }

    @RequestMapping("/**")
    @RequiresPermissions("lingqiong:bridge:use")
    public Result<Object> bridge(
        HttpServletRequest request,
        @RequestBody(required = false) String body
    ) throws Exception {
        String requestUri = request.getRequestURI();
        String marker = "/lingqiong/bridge";
        String path = requestUri.substring(requestUri.indexOf(marker) + marker.length());

        if (path.isBlank() || ALLOWED_PREFIXES.stream().noneMatch(path::startsWith)) {
            return Result.error(404, "不支持的后台业务接口");
        }

        String query = request.getQueryString();
        URI target = URI.create(platformApiUrl + path + (query == null ? "" : "?" + query));
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.setContentType(request.getContentType() == null
            ? MediaType.APPLICATION_JSON
            : MediaType.parseMediaType(request.getContentType()));
        headers.set("X-Lingqiong-Service-Secret", serviceSecret);
        HttpEntity<String> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                target,
                HttpMethod.valueOf(request.getMethod()),
                entity,
                String.class
            );
            if (response.getStatusCode().is2xxSuccessful()) {
                String responseBody = response.getBody();
                Object payload = responseBody == null || responseBody.isBlank()
                    ? java.util.Map.of()
                    : objectMapper.readValue(responseBody, Object.class);
                return Result.OK(payload);
            }
            return Result.error(response.getStatusCode().value(), "官网业务接口调用失败");
        } catch (HttpStatusCodeException exception) {
            return Result.error(exception.getStatusCode().value(), "官网业务接口调用失败");
        } catch (Exception exception) {
            return Result.error(502, "官网业务接口调用异常：" + exception.getClass().getSimpleName());
        }
    }
}
