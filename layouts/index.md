{{ define "main" }}
<section class="hero">
  <h1>{{ .Site.Params.hero.title }}</h1>
  <p>{{ .Site.Params.hero.subtitle }}</p>
  <a href="{{ .Site.Params.hero.buttonLink }}" class="btn">
    {{ .Site.Params.hero.buttonText }}
  </a>
</section>

<section class="features">
  <ul>
    <li>{{ .Site.Params.features.feature1 }}</li>
    <li>{{ .Site.Params.features.feature2 }}</li>
    <li>{{ .Site.Params.features.feature3 }}</li>
  </ul>
</section>
{{ end }}

