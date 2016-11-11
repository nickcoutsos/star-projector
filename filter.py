import argparse
import itertools
import json
import sys

def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('-m', '--magnitude', dest='magnitude', type=float, default=None)
    parser.add_argument('-a', '--include-asterisms', dest='asterisms', default=False, action='store_true')
    parser.add_argument('-d', '--dry-run', dest='dry_run', default=False, action='store_true')
    args = parser.parse_args(argv)

    with open('src/catalogs/hd.json') as f:
        stars = json.loads(f.read())

    with open('src/catalogs/asterisms.json') as f:
        asterisms = json.loads(f.read())
        asterism_stars = set(itertools.chain(*[a['stars'] for a in asterisms]))

    star_filter = []
    if args.magnitude:
        star_filter.append(lambda s: s['mag'] <= args.magnitude)
    if args.asterisms:
        star_filter.append(lambda s: s['hd'] in asterism_stars)

    filtered = filter(lambda s: any((f(s) for f in star_filter)), stars)
    print len(filtered)

    if not args.dry_run:
        with open('src/catalogs/hd_filtered.json', 'w') as f:
            f.write(
                '[\n  ' +
                ',\n  '.join((json.dumps(row, sort_keys=True) for row in filtered)) +
                '\n]\n'
            )

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
