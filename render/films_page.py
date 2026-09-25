"""
apps/walk/films.html as the films' own page, apps/films/index.html: it lists only the films whose
mp4 is already in apps/films/films/, and links back to the walkthrough's artifact instead of to a
page beside it (the films live in an artifact of their own, the walkthrough being near the 64 MB a
page may carry).

    python render/films_page.py
"""
import io
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALK_URL = "https://claude.ai/artifact/T3KjtoXBU4HPGpdTwThPjm"


def main():
    s = io.open(os.path.join(REPO, "apps", "walk", "films.html"), encoding="utf-8").read()
    s = s.replace('<a href="index.html">&larr; Back to the walkthrough</a>', f'<a href="{WALK_URL}">&larr; The walkthrough</a>')
    # Drop any film whose video is not in apps/films/films yet.
    for m in re.findall(r'<section class="film".*?</section>', s, flags=re.S):
        src = re.search(r'src="films/([^"]+)"', m).group(1)
        if not os.path.exists(os.path.join(REPO, "apps", "films", "films", src)):
            s = s.replace(m + "\n", "").replace(m, "")
    io.open(os.path.join(REPO, "apps", "films", "index.html"), "w", encoding="utf-8", newline="\n").write(s)
    print("films on the page:", re.findall(r'src="films/([^"]+)"', s))


if __name__ == "__main__":
    main()
