from django.core.management.base import BaseCommand
from apps.rankings.scraper import scrape_nirf_data
from apps.rankings.views import load_ranking_data

class Command(BaseCommand):
    help = 'Scrapes NIRF ranking data from official portal and caches JSON files'

    def handle(self, *args, **options):
        self.stdout.write('Starting NIRF web scraping...')
        success = scrape_nirf_data()
        if success:
            load_ranking_data.cache_clear()
            self.stdout.write(self.style.SUCCESS('Successfully scraped NIRF data and cleared cache!'))
        else:
            self.stdout.write(self.style.WARNING('NIRF scraper completed with partial or failed tables.'))
