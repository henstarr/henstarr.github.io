# Run after `bundle exec jekyll build` to catch broken internal links and layout drift.
require 'nokogiri'
require 'uri'
require 'pathname'
require 'set'
require 'json'

root = Pathname.new(ARGV[0] || '_site').expand_path
abort "Build the site first: bundle exec jekyll build" unless root.directory?
errors = []
source_css = Pathname.new('assets/css/style.css')
built_css = root.join('assets/css/style.css')
if !built_css.file? || (source_css.file? && built_css.read != source_css.read)
  errors << 'The custom stylesheet was overwritten or omitted during the build'
end
pages = Dir[root.join('**/*.html')].to_h { |path| [Pathname.new(path), Nokogiri::HTML(File.read(path))] }
pages.each do |path, doc|
  relative = path.relative_path_from(root).to_s
  next if relative.start_with?('google')
  report = ->(message) { errors << "#{relative}: #{message}" }
  report.call('expected one h1') unless doc.css('h1').size == 1
  report.call('expected one main') unless doc.css('main').size == 1
  report.call('missing main navigation') unless doc.at_css('nav[aria-label="Main navigation"]')
  report.call('missing subscribe anchor') unless doc.at_css('#subscribe')
  report.call('missing title') if doc.at_css('title')&.text.to_s.strip.empty?
  report.call('missing description') if doc.at_css('meta[name="description"]')&.[]('content').to_s.empty?
  report.call('missing canonical URL') unless doc.at_css('link[rel="canonical"]')
  feed = doc.at_css('link[rel="alternate"][type="application/atom+xml"]')
  report.call('missing Atom feed discovery link') unless feed && feed['href'] == '/feed.xml'
  ids = doc.css('[id]').map { |element| element['id'] }
  report.call('duplicate element IDs') unless ids.uniq == ids
  doc.css('img').each { |img| report.call('image missing alt attribute') unless img.key?('alt') }
  doc.css('input:not([type="hidden"]), textarea, select').each do |field|
    label = field['id'] && doc.at_css("label[for='#{field['id']}']")
    report.call("unlabeled field #{field['id']}") unless label || field['aria-label'] || field['aria-labelledby']
  end
  doc.css('a[href], link[href], script[src], img[src]').each do |element|
    href = element['href'] || element['src']
    next if href.empty? || href.match?(/\A(?:[a-z][a-z0-9+.-]*:|\/\/)/i)
    begin
      uri = URI.parse(href)
      decoded = URI::DEFAULT_PARSER.unescape(uri.path)
      target = decoded.empty? ? path : decoded.start_with?('/') ? root.join(decoded.delete_prefix('/')) : path.dirname.join(decoded)
      target = target.join('index.html') if target.directory? || decoded.end_with?('/')
      report.call("broken internal URL #{href}") unless target.file?
      if uri.fragment && !uri.fragment.empty? && target.file? && target.extname == '.html'
        target_doc = pages[target.cleanpath] || Nokogiri::HTML(File.read(target))
        fragment = URI::DEFAULT_PARSER.unescape(uri.fragment)
        report.call("missing anchor #{href}") unless target_doc.css('[id]').any? { |node| node['id'] == fragment }
      end
    rescue URI::InvalidURIError
      report.call("invalid URL #{href}")
    end
  end
end
%w[feed.xml sitemap.xml].each do |name|
  path = root.join(name)
  if !path.file?
    errors << "Missing #{name}"
  else
    doc = Nokogiri::XML(File.read(path)) { |config| config.strict }
    errors << "Empty #{name}" unless doc.root
  end
rescue Nokogiri::XML::SyntaxError => error
  errors << "Invalid #{name}: #{error.message}"
end
feed_path = root.join('feed.xml')
if feed_path.file?
  feed = Nokogiri::XML(feed_path.read)
  ns = { 'atom' => 'http://www.w3.org/2005/Atom' }
  errors << 'Feed is not an Atom document' unless feed.at_xpath('/atom:feed', ns)
  ids = feed.xpath('/atom:feed/atom:entry/atom:id', ns).map(&:text)
  errors << 'Duplicate feed entry IDs' unless ids.uniq == ids
  feed.xpath('//atom:link', ns).each do |link|
    url = URI.parse(link['href'].to_s)
    errors << 'Feed link must be an absolute HTTPS URL' unless url.is_a?(URI::HTTPS) && url.host
  end
  rss = pages[root.join('rss/index.html')]
  errors << 'RSS page is missing its feed URL' unless rss&.at_css('#feed-url')&.[]('value') == feed.at_xpath('/atom:feed/atom:link[@rel="self"]', ns)&.[]('href')
end
home = pages[root.join('index.html')]
if home
  urls = home.css('.home-posts .post-entry-title a').map { |link| link['href'] }
  errors << 'Homepage repeats a post' unless urls == urls.uniq
end
abort errors.join("\n") unless errors.empty?
puts "Passed: #{pages.size} HTML pages, internal URLs and anchors, labels, unique IDs, shared navigation, RSS, and sitemap."
