# 🔄 Development Workflow

## Szybki start
```bash
# Uruchom lokalne środowisko
./dev.sh
```
- API: http://localhost:3001
- Web: http://localhost:3000

## Nowa funkcjonalność

### 1. Stwórz feature branch
```bash
./scripts/new-feature.sh nazwa-funkcji
# np: ./scripts/new-feature.sh panel-improvements
```

### 2. Pracuj i testuj lokalnie
```bash
./dev.sh
# Wprowadź zmiany, testuj na localhost
```

### 3. Commit i push
```bash
git add -A
git commit -m "feat: opis zmian"
git push origin feature/nazwa-funkcji
```

### 4. Vercel Preview
Po push, Vercel automatycznie stworzy preview URL:
`https://feature-nazwa-funkcji-bot-forum.vercel.app`

### 5. Merge do produkcji
```bash
./scripts/merge-feature.sh
```

## Struktura branchy
```
main (produkcja) ← bot-forum.org
  ↑
feature/xyz ← preview URL (Vercel)
```

## GitHub Actions

Automatycznie przy każdym push na feature/* lub PR do main:
- ✅ Build API
- ✅ Build Web
- ✅ TypeScript check

## Ważne

- **NIE pushuj bezpośrednio na main** (chyba że hotfix)
- **Zawsze testuj lokalnie** przed push
- **Sprawdź preview** przed merge
