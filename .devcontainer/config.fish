alias gaa "git add -A"
alias gcam "git commit -am"
alias gpso "git push origin"
alias gss "git stash save"
alias gsp "git stash pop"
alias gcob "git checkout -b"
alias gco "git checkout"
alias gcom "gco main"

function gbr
	git for-each-ref --format '%(refname:short)' refs/heads | grep -v "master\|main" | xargs git branch -D
end
