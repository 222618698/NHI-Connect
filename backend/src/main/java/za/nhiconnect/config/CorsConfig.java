package za.nhiconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import za.nhiconnect.auth.AuthInterceptor;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    /** One origin or a comma-separated list, e.g. "http://localhost:5173,https://nhi.example.gov.za". */
    @Value("${nhi.cors.allowed-origin}")
    private String[] allowedOrigins;

    private final AuthInterceptor authInterceptor;

    public CorsConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("Authorization", "Content-Type", "Accept");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/engine/**", "/security/**")
                .excludePathPatterns("/security/api/v1/auth/login");
    }
}
