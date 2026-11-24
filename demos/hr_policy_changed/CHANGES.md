# What changed from `demos/hr_policy`

A realistic policy revision, used to exercise `forgeai regress`.

| clause | before | after |
|---|---|---|
| 1.1 annual leave | 22 days | **25 days** |
| 1.1 accrual rate | 1.83 days/month | **2.08 days/month** |
| 2.1 carry-over cap | 5 days | **3 days** |
| 6.x sickness during leave | present | **clause removed** |
| travel 1.1 domestic per-diem | EUR 65 | **EUR 72** |
| travel 1.2 international per-diem | EUR 95 | **EUR 110** |

The removed clause is the interesting one. Changed figures should simply flow
through to new answers; a question whose supporting clause no longer exists
should start being refused, and regression mode should report that as broken
rather than letting a steady headline score hide it.
